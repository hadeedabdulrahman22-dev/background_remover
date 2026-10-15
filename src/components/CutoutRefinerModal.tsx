import React, { useRef, useState, useEffect, useCallback } from 'react';
import {
  Eraser,
  Paintbrush,
  Scissors,
  Wand2,
  Hand,
  Undo2,
  Redo2,
  RotateCcw,
  ZoomIn,
  ZoomOut,
  Maximize2,
  Check,
  X,
  Sparkles,
  Eye,
  HelpCircle,
  Magnet,
  Zap,
  Sliders
} from 'lucide-react';
import {
  buildEdgeMap,
  findSnappedEdgePoint,
  executeSnapCutout,
  computeCutoutShape,
  applyEdgeBarrier,
  EdgeMapData,
  SnapPointPair,
  CutoutShapeResult,
} from '../utils/edgeSnapping';

interface CutoutRefinerModalProps {
  isOpen: boolean;
  onClose: () => void;
  sourceUrl: string;
  resultUrl?: string | null;
  onApply: (blob: Blob) => void;
}

export type ToolMode =
  | 'magnetic'
  | 'snap_eraser'
  | 'erase'
  | 'restore'
  | 'lasso'
  | 'wand'
  | 'pan';

type BackdropMode = 'checkerboard' | 'dark' | 'light' | 'neon';

export const CutoutRefinerModal: React.FC<CutoutRefinerModalProps> = ({
  isOpen,
  onClose,
  sourceUrl,
  resultUrl,
  onApply,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const originalCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const edgeDataRef = useRef<EdgeMapData | null>(null);

  // Tools & settings
  // Default to 'magnetic' so the user immediately gets the requested auto-snapping line feature!
  const [tool, setTool] = useState<ToolMode>('magnetic');
  const [snapRadius, setSnapRadius] = useState<number>(35); // Magnetism radius (px)
  const [autoEraseOnRelease, setAutoEraseOnRelease] = useState<boolean>(true);
  const [brushSize, setBrushSize] = useState<number>(32);
  const [brushHardness, setBrushHardness] = useState<number>(85); // 0 = soft, 100 = crisp
  const [wandTolerance, setWandTolerance] = useState<number>(30); // 1-100
  const [backdrop, setBackdrop] = useState<BackdropMode>('checkerboard');
  const [ghostOpacity, setGhostOpacity] = useState<number>(0); // 0-100% overlay of original

  // Viewport navigation
  const [zoom, setZoom] = useState<number>(1);
  const [pan, setPan] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const [spacePressed, setSpacePressed] = useState(false);
  const panStartRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });

  // Drawing state
  const isDrawingRef = useRef(false);
  const lastPointRef = useRef<{ x: number; y: number } | null>(null);
  const [cursorPos, setCursorPos] = useState<{ x: number; y: number } | null>(null);
  const [isHoveringCanvas, setIsHoveringCanvas] = useState(false);

  // Synchronized Magnetic Snapping State
  const [magneticPreview, setMagneticPreview] = useState<{
    rawX: number;
    rawY: number;
    snapX: number;
    snapY: number;
    hasSnap: boolean;
  } | null>(null);
  const [snapPairs, setSnapPairs] = useState<SnapPointPair[]>([]);
  const [invertCutSide, setInvertCutSide] = useState<boolean>(false);
  const [cutClearWidth, setCutClearWidth] = useState<number>(45);
  const isSnappingRef = useRef(false);

  // Real-time calculated cutout shape for instant visualization
  const cutoutShape = React.useMemo<CutoutShapeResult | null>(() => {
    if (snapPairs.length < 2) return null;
    return computeCutoutShape(snapPairs, cutClearWidth, invertCutSide);
  }, [snapPairs, cutClearWidth, invertCutSide]);

  // Lasso state
  const [lassoPoints, setLassoPoints] = useState<Array<{ x: number; y: number }>>([]);
  const isLassoingRef = useRef(false);

  // History stack for Undo / Redo
  const [history, setHistory] = useState<ImageData[]>([]);
  const [historyIndex, setHistoryIndex] = useState<number>(-1);
  const [imageSize, setImageSize] = useState<{ width: number; height: number }>({ width: 0, height: 0 });
  const [loading, setLoading] = useState<boolean>(true);

  // Push current canvas state to history and re-evaluate multi-channel edge data
  const pushHistory = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return;

    try {
      const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      setHistory((prev) => {
        const next = prev.slice(0, historyIndex + 1);
        if (next.length >= 15) next.shift();
        return [...next, imgData];
      });
      setHistoryIndex((prev) => Math.min(prev + 1, 14));

      // Re-index edges for modified canvas using color + alpha channels
      if (originalCanvasRef.current && canvasRef.current) {
        edgeDataRef.current = buildEdgeMap(originalCanvasRef.current, canvasRef.current);
      }
    } catch {
      // ignore security/memory errors
    }
  }, [historyIndex]);

  // Initialize canvases & build edge gradient map when modal opens
  useEffect(() => {
    if (!isOpen) {
      setHistory([]);
      setHistoryIndex(-1);
      setSnapPairs([]);
      setLassoPoints([]);
      setZoom(1);
      setPan({ x: 0, y: 0 });
      setMagneticPreview(null);
      return;
    }

    setLoading(true);
    let active = true;

    const sourceImg = new Image();
    const targetUrl = resultUrl || sourceUrl;
    const targetImg = new Image();

    if (!sourceUrl.startsWith('blob:') && !sourceUrl.startsWith('data:')) {
      sourceImg.crossOrigin = 'anonymous';
    }
    if (!targetUrl.startsWith('blob:') && !targetUrl.startsWith('data:')) {
      targetImg.crossOrigin = 'anonymous';
    }

    sourceImg.onload = () => {
      if (!active) return;
      const w = sourceImg.naturalWidth || sourceImg.width;
      const h = sourceImg.naturalHeight || sourceImg.height;
      setImageSize({ width: w, height: h });

      // Build offscreen original canvas for edge detection & restoring
      const origCanvas = document.createElement('canvas');
      origCanvas.width = w;
      origCanvas.height = h;
      const origCtx = origCanvas.getContext('2d', { willReadFrequently: true });
      if (origCtx) {
        origCtx.drawImage(sourceImg, 0, 0, w, h);
      }
      originalCanvasRef.current = origCanvas;

      // Pre-compute multi-channel edge map from original image for instantaneous snapping
      edgeDataRef.current = buildEdgeMap(origCanvas);

      targetImg.onload = () => {
        if (!active) return;
        const mainCanvas = canvasRef.current;
        if (!mainCanvas) return;
        mainCanvas.width = w;
        mainCanvas.height = h;
        const ctx = mainCanvas.getContext('2d', { willReadFrequently: true });
        if (!ctx) return;

        ctx.clearRect(0, 0, w, h);
        ctx.drawImage(targetImg, 0, 0, w, h);

        // Enhance edge map with existing alpha cutout transitions
        edgeDataRef.current = buildEdgeMap(origCanvas, mainCanvas);

        const initialData = ctx.getImageData(0, 0, w, h);
        setHistory([initialData]);
        setHistoryIndex(0);
        setLoading(false);

        // Fit zoom to container
        if (containerRef.current) {
          const containerW = containerRef.current.clientWidth - 48;
          const containerH = containerRef.current.clientHeight - 48;
          const scaleW = containerW / w;
          const scaleH = containerH / h;
          const fitScale = Math.min(1, Math.min(scaleW, scaleH));
          setZoom(Math.max(0.2, Math.round(fitScale * 100) / 100));
        }
      };
      targetImg.src = targetUrl;
    };
    sourceImg.src = sourceUrl;

    return () => {
      active = false;
    };
  }, [isOpen, sourceUrl, resultUrl]);

  // Undo / Redo handlers
  const handleUndo = () => {
    if (historyIndex <= 0) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return;

    const targetIdx = historyIndex - 1;
    const targetData = history[targetIdx];
    if (targetData) {
      ctx.putImageData(targetData, 0, 0);
      setHistoryIndex(targetIdx);
      setSnapPairs([]);
    }
  };

  const handleRedo = () => {
    if (historyIndex >= history.length - 1) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return;

    const targetIdx = historyIndex + 1;
    const targetData = history[targetIdx];
    if (targetData) {
      ctx.putImageData(targetData, 0, 0);
      setHistoryIndex(targetIdx);
      setSnapPairs([]);
    }
  };

  const handleResetToInitial = () => {
    if (history.length === 0) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return;

    const initial = history[0];
    if (initial) {
      ctx.putImageData(initial, 0, 0);
      pushHistory();
      setSnapPairs([]);
    }
  };

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isOpen) return;

      if (e.code === 'Space' && !spacePressed) {
        setSpacePressed(true);
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        if (e.shiftKey) handleRedo();
        else handleUndo();
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') {
        e.preventDefault();
        handleRedo();
      } else if (e.key === '[') {
        setBrushSize((s) => Math.max(4, s - 6));
      } else if (e.key === ']') {
        setBrushSize((s) => Math.min(180, s + 6));
      } else if (e.key === 'm' || e.key === 'M') {
        setTool('magnetic');
      } else if (e.key === 'e' || e.key === 'E') {
        setTool('erase');
      } else if (e.key === 'r' || e.key === 'R') {
        setTool('restore');
      } else if (e.key === 'l' || e.key === 'L') {
        setTool('lasso');
      } else if (e.key === 'w' || e.key === 'W') {
        setTool('wand');
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        setSpacePressed(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [isOpen, spacePressed, historyIndex, history]);

  // Convert client mouse/touch event coordinates into canvas pixel space
  const getCanvasCoords = (clientX: number, clientY: number): { x: number; y: number } | null => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    return {
      x: (clientX - rect.left) * scaleX,
      y: (clientY - rect.top) * scaleY,
    };
  };

  // Erase or Restore stroke
  const drawStroke = (from: { x: number; y: number }, to: { x: number; y: number }) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return;

    const origCanvas = originalCanvasRef.current;
    const dx = to.x - from.x;
    const dy = to.y - from.y;
    const dist = Math.hypot(dx, dy);
    const step = Math.max(1, brushSize * 0.15);
    const steps = Math.max(1, Math.ceil(dist / step));

    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      let cx = from.x + dx * t;
      let cy = from.y + dy * t;
      const radius = brushSize / 2;

      if (tool === 'snap_eraser') {
        ctx.save();
        // If near an object edge, apply boundary tangent barrier to prevent erasing the subject
        if (edgeDataRef.current) {
          const snap = findSnappedEdgePoint(cx, cy, edgeDataRef.current, snapRadius);
          if (snap.hasSnap) {
            applyEdgeBarrier(ctx, cx, cy, snap.x, snap.y, radius);
          }
        }
        ctx.globalCompositeOperation = 'destination-out';
        const grad = ctx.createRadialGradient(cx, cy, radius * (brushHardness / 100), cx, cy, radius);
        grad.addColorStop(0, 'rgba(0, 0, 0, 1)');
        grad.addColorStop(1, 'rgba(0, 0, 0, 0)');
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(cx, cy, radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      } else if (tool === 'erase') {
        ctx.save();
        ctx.globalCompositeOperation = 'destination-out';
        const grad = ctx.createRadialGradient(cx, cy, radius * (brushHardness / 100), cx, cy, radius);
        grad.addColorStop(0, 'rgba(0, 0, 0, 1)');
        grad.addColorStop(1, 'rgba(0, 0, 0, 0)');
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(cx, cy, radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      } else if (tool === 'restore' && origCanvas) {
        ctx.save();
        ctx.beginPath();
        ctx.arc(cx, cy, radius, 0, Math.PI * 2);
        ctx.clip();
        ctx.globalCompositeOperation = 'source-over';
        ctx.drawImage(origCanvas, 0, 0);
        ctx.restore();
      }
    }
  };

  // Execute magnetic cutout along the snapped line
  const handleApplySnapCut = () => {
    if (snapPairs.length < 2) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return;

    executeSnapCutout(ctx, snapPairs, cutClearWidth, invertCutSide);
    setSnapPairs([]);
    pushHistory();
  };

  // Magic Wand color eraser
  const handleWandErase = (startX: number, startY: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;
    const x0 = Math.floor(startX);
    const y0 = Math.floor(startY);
    if (x0 < 0 || x0 >= width || y0 < 0 || y0 >= height) return;

    const imgData = ctx.getImageData(0, 0, width, height);
    const data = imgData.data;

    const startIndex = (y0 * width + x0) * 4;
    const targetR = data[startIndex];
    const targetG = data[startIndex + 1];
    const targetB = data[startIndex + 2];
    const targetA = data[startIndex + 3];

    if (targetA === 0) return;

    const tol = wandTolerance * 2.55;
    const visited = new Uint8Array(width * height);
    const queue: number[] = [x0 + y0 * width];
    visited[x0 + y0 * width] = 1;

    let head = 0;
    while (head < queue.length) {
      const idx = queue[head++];
      const px = idx % width;
      const py = Math.floor(idx / width);
      const byteIdx = idx * 4;

      const r = data[byteIdx];
      const g = data[byteIdx + 1];
      const b = data[byteIdx + 2];
      const a = data[byteIdx + 3];

      const diff = Math.sqrt(
        (r - targetR) ** 2 +
        (g - targetG) ** 2 +
        (b - targetB) ** 2 +
        (a - targetA) ** 2
      );

      if (diff <= tol) {
        data[byteIdx + 3] = 0;
        if (px > 0 && !visited[idx - 1]) {
          visited[idx - 1] = 1;
          queue.push(idx - 1);
        }
        if (px < width - 1 && !visited[idx + 1]) {
          visited[idx + 1] = 1;
          queue.push(idx + 1);
        }
        if (py > 0 && !visited[idx - width]) {
          visited[idx - width] = 1;
          queue.push(idx - width);
        }
        if (py < height - 1 && !visited[idx + width]) {
          visited[idx + width] = 1;
          queue.push(idx + width);
        }
      }
    }

    ctx.putImageData(imgData, 0, 0);
    pushHistory();
  };

  // Erase enclosed Lasso area
  const handleApplyLassoCut = () => {
    if (lassoPoints.length < 3) {
      setLassoPoints([]);
      return;
    }
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return;

    ctx.save();
    ctx.globalCompositeOperation = 'destination-out';
    ctx.beginPath();
    ctx.moveTo(lassoPoints[0].x, lassoPoints[0].y);
    for (let i = 1; i < lassoPoints.length; i++) {
      ctx.lineTo(lassoPoints[i].x, lassoPoints[i].y);
    }
    ctx.closePath();
    ctx.fillStyle = 'rgba(0, 0, 0, 1)';
    ctx.fill();
    ctx.restore();

    setLassoPoints([]);
    pushHistory();
  };

  // 1-Click Auto Edge De-fringe
  const handleDeFringe = (pixels: number = 1) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return;

    const w = canvas.width;
    const h = canvas.height;
    const imgData = ctx.getImageData(0, 0, w, h);
    const data = imgData.data;
    const alphaCopy = new Uint8Array(w * h);

    for (let i = 0; i < w * h; i++) {
      alphaCopy[i] = data[i * 4 + 3];
    }

    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const idx = y * w + x;
        const curA = alphaCopy[idx];
        if (curA === 0) continue;

        let hasTransparentNeighbor = false;
        for (let dy = -pixels; dy <= pixels && !hasTransparentNeighbor; dy++) {
          for (let dx = -pixels; dx <= pixels; dx++) {
            const nx = x + dx;
            const ny = y + dy;
            if (nx < 0 || nx >= w || ny < 0 || ny >= h || alphaCopy[ny * w + nx] === 0) {
              hasTransparentNeighbor = true;
              break;
            }
          }
        }

        if (hasTransparentNeighbor) {
          data[idx * 4 + 3] = 0;
        }
      }
    }

    ctx.putImageData(imgData, 0, 0);
    pushHistory();
  };

  // 1-Click Smooth Alpha Edges
  const handleSmoothEdges = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return;

    const w = canvas.width;
    const h = canvas.height;
    const imgData = ctx.getImageData(0, 0, w, h);
    const data = imgData.data;
    const alphaCopy = new Uint8Array(w * h);

    for (let i = 0; i < w * h; i++) {
      alphaCopy[i] = data[i * 4 + 3];
    }

    for (let y = 1; y < h - 1; y++) {
      for (let x = 1; x < w - 1; x++) {
        const idx = y * w + x;
        const curA = alphaCopy[idx];
        if (curA > 0 && curA < 255) {
          let sum = 0;
          for (let dy = -1; dy <= 1; dy++) {
            for (let dx = -1; dx <= 1; dx++) {
              sum += alphaCopy[(y + dy) * w + (x + dx)];
            }
          }
          data[idx * 4 + 3] = Math.round(sum / 9);
        }
      }
    }

    ctx.putImageData(imgData, 0, 0);
    pushHistory();
  };

  // Mouse / Touch event handlers
  const handlePointerDown = (e: React.PointerEvent) => {
    if (loading) return;

    if (tool === 'pan' || spacePressed || e.button === 1) {
      setIsPanning(true);
      panStartRef.current = { x: e.clientX - pan.x, y: e.clientY - pan.y };
      return;
    }

    if (e.button !== 0) return;

    const coords = getCanvasCoords(e.clientX, e.clientY);
    if (!coords) return;

    if (tool === 'wand') {
      handleWandErase(coords.x, coords.y);
      return;
    }

    if (tool === 'lasso') {
      isLassoingRef.current = true;
      setLassoPoints([coords]);
      return;
    }

    if (tool === 'magnetic') {
      isSnappingRef.current = true;
      const snapRes = edgeDataRef.current
        ? findSnappedEdgePoint(coords.x, coords.y, edgeDataRef.current, snapRadius)
        : { x: coords.x, y: coords.y, hasSnap: false };

      const firstPair: SnapPointPair = {
        rough: coords,
        snapped: { x: snapRes.x, y: snapRes.y },
      };
      setSnapPairs([firstPair]);
      return;
    }

    if (tool === 'erase' || tool === 'restore' || tool === 'snap_eraser') {
      isDrawingRef.current = true;
      lastPointRef.current = coords;
      drawStroke(coords, coords);
    }
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    setCursorPos({ x: e.clientX, y: e.clientY });

    if (isPanning) {
      setPan({
        x: e.clientX - panStartRef.current.x,
        y: e.clientY - panStartRef.current.y,
      });
      return;
    }

    const coords = getCanvasCoords(e.clientX, e.clientY);
    if (!coords) return;

    // Real-time magnetic edge hover indicator
    if (edgeDataRef.current && (tool === 'magnetic' || tool === 'snap_eraser')) {
      const snap = findSnappedEdgePoint(coords.x, coords.y, edgeDataRef.current, snapRadius);
      setMagneticPreview({
        rawX: coords.x,
        rawY: coords.y,
        snapX: snap.x,
        snapY: snap.y,
        hasSnap: snap.hasSnap,
      });
    } else {
      setMagneticPreview(null);
    }

    // Active Magnetic Line drawing
    if (tool === 'magnetic' && isSnappingRef.current) {
      const snapRes = edgeDataRef.current
        ? findSnappedEdgePoint(coords.x, coords.y, edgeDataRef.current, snapRadius)
        : { x: coords.x, y: coords.y, hasSnap: false };

      const newPair: SnapPointPair = {
        rough: coords,
        snapped: { x: snapRes.x, y: snapRes.y },
      };

      setSnapPairs((prev) => {
        const last = prev[prev.length - 1];
        if (!last || Math.hypot(coords.x - last.rough.x, coords.y - last.rough.y) > 3) {
          return [...prev, newPair];
        }
        return prev;
      });
      return;
    }

    // Lasso drawing
    if (tool === 'lasso' && isLassoingRef.current) {
      setLassoPoints((prev) => {
        const last = prev[prev.length - 1];
        if (!last || Math.hypot(coords.x - last.x, coords.y - last.y) > 4) {
          return [...prev, coords];
        }
        return prev;
      });
      return;
    }

    // Freehand stroke drawing
    if (isDrawingRef.current && lastPointRef.current) {
      drawStroke(lastPointRef.current, coords);
      lastPointRef.current = coords;
    }
  };

  const handlePointerUp = () => {
    if (isPanning) {
      setIsPanning(false);
      return;
    }

    // Finished drawing magnetic line beside object
    if (tool === 'magnetic' && isSnappingRef.current) {
      isSnappingRef.current = false;

      if (snapPairs.length >= 2) {
        if (autoEraseOnRelease) {
          // Immediately erase leftover background up to the snapped contour!
          const canvas = canvasRef.current;
          if (canvas) {
            const ctx = canvas.getContext('2d', { willReadFrequently: true });
            if (ctx) {
              executeSnapCutout(ctx, snapPairs, cutClearWidth, invertCutSide);
              pushHistory();
            }
          }
          setSnapPairs([]);
        }
      }
      return;
    }

    if (tool === 'lasso' && isLassoingRef.current) {
      isLassoingRef.current = false;
      return;
    }

    if (isDrawingRef.current) {
      isDrawingRef.current = false;
      lastPointRef.current = null;
      pushHistory();
    }
  };

  // Zoom controls
  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const factor = e.deltaY < 0 ? 1.15 : 0.85;
    setZoom((z) => Math.min(5, Math.max(0.15, Math.round(z * factor * 100) / 100)));
  };

  const handleFitToScreen = () => {
    if (!containerRef.current || imageSize.width === 0) return;
    const containerW = containerRef.current.clientWidth - 48;
    const containerH = containerRef.current.clientHeight - 48;
    const scaleW = containerW / imageSize.width;
    const scaleH = containerH / imageSize.height;
    const fitScale = Math.min(1, Math.min(scaleW, scaleH));
    setZoom(Math.max(0.2, Math.round(fitScale * 100) / 100));
    setPan({ x: 0, y: 0 });
  };

  // Save and apply changes
  const handleSave = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    canvas.toBlob((blob) => {
      if (blob) {
        onApply(blob);
        onClose();
      }
    }, 'image/png');
  };

  if (!isOpen) return null;

  return (
    <div
      id="cutout-refiner-modal"
      className="fixed inset-0 z-50 flex flex-col bg-[#0B1F1A] text-white select-none animate-in fade-in duration-200"
    >
      {/* Top Header Bar */}
      <header className="h-14 border-b border-[#22443A] bg-[#10231F] px-4 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-[#5EE0B5] flex items-center justify-center text-[#10231F] shadow-sm">
            <Magnet className="w-4 h-4" />
          </div>
          <div>
            <h3 className="font-extrabold text-sm sm:text-base leading-tight tracking-tight text-white flex items-center gap-2">
              <span>Smart Edge-Snap Cutout & Eraser</span>
              <span className="text-[10px] font-bold tracking-normal text-[#10231F] bg-[#5EE0B5] px-2 py-0.5 rounded-full shadow-xs">
                Auto-Snap Active
              </span>
            </h3>
            <p className="text-xs text-[#A3C8BD] hidden sm:block">
              Draw a line beside the object — it automatically snaps to the edge and clears leftover background!
            </p>
          </div>
        </div>

        {/* Action Controls & Navigation */}
        <div className="flex items-center gap-1.5 sm:gap-2">
          {/* Undo / Redo */}
          <div className="flex items-center bg-[#17382F] rounded-lg p-0.5 border border-[#275346]">
            <button
              onClick={handleUndo}
              disabled={historyIndex <= 0}
              title="Undo (Ctrl+Z)"
              className="p-1.5 rounded-md hover:bg-white/10 disabled:opacity-30 disabled:hover:bg-transparent transition-all cursor-pointer"
            >
              <Undo2 className="w-4 h-4" />
            </button>
            <button
              onClick={handleRedo}
              disabled={historyIndex >= history.length - 1}
              title="Redo (Ctrl+Y)"
              className="p-1.5 rounded-md hover:bg-white/10 disabled:opacity-30 disabled:hover:bg-transparent transition-all cursor-pointer"
            >
              <Redo2 className="w-4 h-4" />
            </button>
          </div>

          <button
            onClick={handleResetToInitial}
            title="Reset to initial cutout"
            className="p-2 rounded-lg bg-[#17382F] hover:bg-[#1F4A3E] text-white/90 border border-[#275346] text-xs font-semibold flex items-center gap-1 transition-all cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span className="hidden md:inline">Reset</span>
          </button>

          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-white/10 text-white/80 hover:text-white transition-colors cursor-pointer"
            title="Close without saving"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </header>

      {/* Main Workspace Layout */}
      <div className="flex-1 flex flex-col md:flex-row overflow-hidden relative">
        {/* Left Toolbar */}
        <aside className="w-full md:w-72 bg-[#0E1E1A] border-b md:border-b-0 md:border-r border-[#22443A] p-3 sm:p-4 flex flex-col gap-4 overflow-y-auto shrink-0 z-20">
          {/* Tool Modes */}
          <div className="flex flex-col gap-1.5">
            <label className="text-[11px] font-bold uppercase tracking-wider text-[#A3C8BD] flex items-center justify-between">
              <span>Select Tool</span>
              <span className="text-[10px] text-[#5EE0B5] font-semibold">Recommended</span>
            </label>

            {/* Smart Snap Line (Hero Feature) */}
            <button
              onClick={() => setTool('magnetic')}
              className={`w-full py-2.5 px-3 rounded-xl font-extrabold text-xs flex items-center justify-between transition-all cursor-pointer border ${
                tool === 'magnetic'
                  ? 'bg-[#5EE0B5] text-[#10231F] border-[#5EE0B5] shadow-md scale-[1.01]'
                  : 'bg-[#17382F] text-white/90 hover:bg-[#1E453A] border-[#275346]'
              }`}
            >
              <div className="flex items-center gap-2">
                <Magnet className="w-4 h-4 shrink-0" />
                <span className="font-extrabold">Smart Snap Line</span>
              </div>
              <span className={`text-[10px] px-1.5 py-0.5 rounded-md font-bold uppercase ${
                tool === 'magnetic' ? 'bg-[#10231F]/15 text-[#10231F]' : 'bg-[#5EE0B5]/20 text-[#5EE0B5]'
              }`}>
                Auto-Edge
              </span>
            </button>

            {/* Smart Snap Eraser */}
            <button
              onClick={() => setTool('snap_eraser')}
              className={`w-full py-2 px-3 rounded-xl font-bold text-xs flex items-center justify-between transition-all cursor-pointer border ${
                tool === 'snap_eraser'
                  ? 'bg-[#5EE0B5] text-[#10231F] border-[#5EE0B5] shadow-sm'
                  : 'bg-[#17382F] text-white/90 hover:bg-[#1E453A] border-[#275346]'
              }`}
            >
              <div className="flex items-center gap-2">
                <Zap className="w-4 h-4 shrink-0" />
                <span>Snap-To-Edge Eraser</span>
              </div>
              <span className="text-[10px] text-[#A3C8BD] font-mono">No Cut-In</span>
            </button>

            <div className="grid grid-cols-2 gap-1.5 mt-1">
              <button
                onClick={() => setTool('erase')}
                className={`py-2 px-2.5 rounded-xl font-bold text-xs flex items-center gap-1.5 transition-all cursor-pointer ${
                  tool === 'erase'
                    ? 'bg-[#5EE0B5] text-[#10231F] shadow-sm'
                    : 'bg-[#17382F] text-white/90 hover:bg-[#1E453A] border border-[#275346]'
                }`}
              >
                <Eraser className="w-3.5 h-3.5 shrink-0" />
                <span className="truncate">Manual Erase</span>
              </button>

              <button
                onClick={() => setTool('restore')}
                className={`py-2 px-2.5 rounded-xl font-bold text-xs flex items-center gap-1.5 transition-all cursor-pointer ${
                  tool === 'restore'
                    ? 'bg-[#5EE0B5] text-[#10231F] shadow-sm'
                    : 'bg-[#17382F] text-white/90 hover:bg-[#1E453A] border border-[#275346]'
                }`}
              >
                <Paintbrush className="w-3.5 h-3.5 shrink-0" />
                <span className="truncate">Restore Subject</span>
              </button>

              <button
                onClick={() => setTool('wand')}
                className={`py-2 px-2.5 rounded-xl font-bold text-xs flex items-center gap-1.5 transition-all cursor-pointer ${
                  tool === 'wand'
                    ? 'bg-[#5EE0B5] text-[#10231F] shadow-sm'
                    : 'bg-[#17382F] text-white/90 hover:bg-[#1E453A] border border-[#275346]'
                }`}
              >
                <Wand2 className="w-3.5 h-3.5 shrink-0" />
                <span className="truncate">Magic Color</span>
              </button>

              <button
                onClick={() => setTool('lasso')}
                className={`py-2 px-2.5 rounded-xl font-bold text-xs flex items-center gap-1.5 transition-all cursor-pointer ${
                  tool === 'lasso'
                    ? 'bg-[#5EE0B5] text-[#10231F] shadow-sm'
                    : 'bg-[#17382F] text-white/90 hover:bg-[#1E453A] border border-[#275346]'
                }`}
              >
                <Scissors className="w-3.5 h-3.5 shrink-0" />
                <span className="truncate">Lasso Area</span>
              </button>
            </div>

            <button
              onClick={() => setTool('pan')}
              className={`w-full py-1.5 px-2.5 rounded-lg font-semibold text-xs flex items-center justify-center gap-1.5 transition-all mt-1 cursor-pointer ${
                tool === 'pan'
                  ? 'bg-white text-[#10231F]'
                  : 'bg-[#17382F]/70 text-white/70 hover:bg-[#1E453A]'
              }`}
            >
              <Hand className="w-3.5 h-3.5" />
              <span>Pan Canvas (or hold Spacebar)</span>
            </button>
          </div>

          {/* Magnetic Snap Line Controls */}
          {tool === 'magnetic' && (
            <div className="flex flex-col gap-2.5 bg-[#132A23] p-3 rounded-xl border border-[#5EE0B5]/30 animate-in fade-in duration-150">
              <div className="flex items-center justify-between">
                <span className="text-xs font-extrabold text-[#5EE0B5] flex items-center gap-1.5">
                  <Magnet className="w-3.5 h-3.5" />
                  <span>Magnetic Cutout Controls</span>
                </span>
                <span className="font-mono text-xs text-white">{snapRadius}px snap</span>
              </div>

              <div>
                <div className="flex justify-between items-center text-xs text-[#A3C8BD] mb-1">
                  <span>Snap Magnetism (Reach)</span>
                  <span className="text-[11px] text-white/70">
                    {snapRadius <= 25 ? 'Tight' : snapRadius <= 40 ? 'Medium' : 'Wide'}
                  </span>
                </div>
                <input
                  type="range"
                  min="16"
                  max="60"
                  value={snapRadius}
                  onChange={(e) => setSnapRadius(Number(e.target.value))}
                  className="w-full accent-[#5EE0B5] cursor-pointer"
                />
              </div>

              <div>
                <div className="flex justify-between items-center text-xs text-[#A3C8BD] mb-1">
                  <span>Leftover Removal Reach</span>
                  <span className="font-mono text-white text-[11px]">{cutClearWidth}px</span>
                </div>
                <input
                  type="range"
                  min="20"
                  max="120"
                  value={cutClearWidth}
                  onChange={(e) => setCutClearWidth(Number(e.target.value))}
                  className="w-full accent-[#5EE0B5] cursor-pointer"
                />
              </div>

              {/* Side toggle: Background vs Invert */}
              <button
                type="button"
                onClick={() => setInvertCutSide((v) => !v)}
                className="w-full py-1.5 px-2 bg-[#1B3E34] hover:bg-[#234D41] text-white text-xs font-semibold rounded-lg flex items-center justify-between transition-colors border border-[#2E6354] cursor-pointer"
              >
                <span className="text-[#A3C8BD] text-[11px]">Cutout Side:</span>
                <span className="font-bold text-[#5EE0B5] flex items-center gap-1 text-[11px]">
                  <RotateCcw className="w-3 h-3" />
                  {invertCutSide ? 'Invert (Subject Side)' : 'Leftover Background (Outer)'}
                </span>
              </button>

              {/* Auto erase toggle */}
              <label className="flex items-center gap-2 cursor-pointer pt-1 border-t border-[#22443A]">
                <input
                  type="checkbox"
                  checked={autoEraseOnRelease}
                  onChange={(e) => setAutoEraseOnRelease(e.target.checked)}
                  className="w-4 h-4 accent-[#5EE0B5] rounded cursor-pointer"
                />
                <div className="text-xs">
                  <p className="font-bold text-white leading-tight">Instant Cut on Release</p>
                  <p className="text-[10px] text-[#A3C8BD]">Auto-removes red area when you lift cursor</p>
                </div>
              </label>

              {/* Active path action buttons */}
              {snapPairs.length > 1 && (
                <div className="flex flex-col gap-1.5 pt-2 border-t border-[#22443A]">
                  <button
                    onClick={handleApplySnapCut}
                    className="w-full py-2 px-3 bg-[#5EE0B5] hover:bg-[#4DD0A5] text-[#10231F] font-extrabold text-xs rounded-lg flex items-center justify-center gap-1.5 transition-all cursor-pointer shadow-md"
                  >
                    <Check className="w-4 h-4" />
                    <span>Cut & Remove Red Zone Now</span>
                  </button>
                  <button
                    onClick={() => setSnapPairs([])}
                    className="w-full py-1.5 px-2 bg-white/10 hover:bg-white/20 text-white text-xs font-semibold rounded-lg cursor-pointer"
                  >
                    Clear Path
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Brush Controls (Size & Hardness) */}
          {(tool === 'erase' || tool === 'restore' || tool === 'snap_eraser') && (
            <div className="flex flex-col gap-3 bg-[#132A23] p-3 rounded-xl border border-[#22443A]">
              <div>
                <div className="flex justify-between items-center text-xs font-bold text-white mb-1.5">
                  <span className="text-[#A3C8BD]">Brush Size</span>
                  <span className="font-mono text-[#5EE0B5]">{brushSize}px</span>
                </div>
                <input
                  type="range"
                  min="6"
                  max="140"
                  value={brushSize}
                  onChange={(e) => setBrushSize(Number(e.target.value))}
                  className="w-full accent-[#5EE0B5] cursor-pointer"
                />
              </div>

              <div>
                <div className="flex justify-between items-center text-xs font-bold text-white mb-1.5">
                  <span className="text-[#A3C8BD]">Edge Softness</span>
                  <span className="font-mono text-[#5EE0B5]">
                    {brushHardness === 100 ? 'Hard Edge' : `${brushHardness}%`}
                  </span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={brushHardness}
                  onChange={(e) => setBrushHardness(Number(e.target.value))}
                  className="w-full accent-[#5EE0B5] cursor-pointer"
                />
              </div>
            </div>
          )}

          {/* Magic Wand Tolerance */}
          {tool === 'wand' && (
            <div className="flex flex-col gap-2 bg-[#132A23] p-3 rounded-xl border border-[#22443A]">
              <div className="flex justify-between items-center text-xs font-bold text-white">
                <span className="text-[#A3C8BD]">Color Tolerance</span>
                <span className="font-mono text-[#5EE0B5]">{wandTolerance}</span>
              </div>
              <input
                type="range"
                min="5"
                max="80"
                value={wandTolerance}
                onChange={(e) => setWandTolerance(Number(e.target.value))}
                className="w-full accent-[#5EE0B5] cursor-pointer"
              />
              <p className="text-[11px] text-[#A3C8BD]">
                Click any leftover spot on the image to erase all matching connected colors.
              </p>
            </div>
          )}

          {/* Lasso Active Controls */}
          {tool === 'lasso' && lassoPoints.length > 2 && (
            <div className="bg-[#17382F] border border-[#5EE0B5]/40 rounded-xl p-2.5 flex flex-col gap-2 animate-in fade-in duration-200">
              <span className="text-xs text-[#5EE0B5] font-semibold">
                Area selected ({lassoPoints.length} points)
              </span>
              <div className="flex gap-2">
                <button
                  onClick={handleApplyLassoCut}
                  className="flex-1 py-1.5 px-3 bg-[#5EE0B5] hover:bg-[#4DD0A5] text-[#10231F] font-bold text-xs rounded-lg flex items-center justify-center gap-1 transition-all cursor-pointer"
                >
                  <Scissors className="w-3.5 h-3.5" />
                  <span>Erase Inside</span>
                </button>
                <button
                  onClick={() => setLassoPoints([])}
                  className="py-1.5 px-2.5 bg-white/10 hover:bg-white/20 text-white text-xs font-semibold rounded-lg cursor-pointer"
                >
                  Clear
                </button>
              </div>
            </div>
          )}

          {/* 1-Click Edge Precision Filters */}
          <div className="flex flex-col gap-2 bg-[#132A23] p-3 rounded-xl border border-[#22443A]">
            <label className="text-[11px] font-bold uppercase tracking-wider text-[#A3C8BD] flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-[#5EE0B5]" />
              <span>Instant Edge Precision</span>
            </label>
            <div className="grid grid-cols-2 gap-1.5">
              <button
                onClick={() => handleDeFringe(1)}
                title="Shifts border inward by 1px to peel off background halo color"
                className="py-1.5 px-2 bg-[#17382F] hover:bg-[#1E453A] border border-[#275346] rounded-lg text-xs font-semibold text-white/90 text-left transition-all cursor-pointer"
              >
                Trim Fringe (1px)
              </button>
              <button
                onClick={() => handleDeFringe(2)}
                title="Shifts border inward by 2px for thicker halos"
                className="py-1.5 px-2 bg-[#17382F] hover:bg-[#1E453A] border border-[#275346] rounded-lg text-xs font-semibold text-white/90 text-left transition-all cursor-pointer"
              >
                Trim Fringe (2px)
              </button>
              <button
                onClick={handleSmoothEdges}
                title="Softens jagged and pixelated edges"
                className="col-span-2 py-1.5 px-2 bg-[#17382F] hover:bg-[#1E453A] border border-[#275346] rounded-lg text-xs font-semibold text-white/90 text-center transition-all cursor-pointer"
              >
                Smooth Alpha Edges
              </button>
            </div>
          </div>

          {/* Backdrop Inspector */}
          <div className="flex flex-col gap-2">
            <label className="text-[11px] font-bold uppercase tracking-wider text-[#A3C8BD] flex items-center gap-1.5">
              <Eye className="w-3.5 h-3.5 text-[#5EE0B5]" />
              <span>Inspect Backdrop</span>
            </label>
            <div className="grid grid-cols-4 gap-1.5">
              <button
                onClick={() => setBackdrop('checkerboard')}
                title="Checkerboard (Transparent)"
                className={`h-8 rounded-lg border flex items-center justify-center transition-all cursor-pointer ${
                  backdrop === 'checkerboard'
                    ? 'border-[#5EE0B5] ring-2 ring-[#5EE0B5]/30'
                    : 'border-[#275346]'
                } bg-checkerboard`}
              />
              <button
                onClick={() => setBackdrop('dark')}
                title="Dark Matte"
                className={`h-8 rounded-lg border bg-[#10231F] flex items-center justify-center transition-all cursor-pointer ${
                  backdrop === 'dark'
                    ? 'border-[#5EE0B5] ring-2 ring-[#5EE0B5]/30'
                    : 'border-[#275346]'
                }`}
              />
              <button
                onClick={() => setBackdrop('light')}
                title="Light Matte"
                className={`h-8 rounded-lg border bg-white flex items-center justify-center transition-all cursor-pointer ${
                  backdrop === 'light'
                    ? 'border-[#5EE0B5] ring-2 ring-[#5EE0B5]/30'
                    : 'border-[#275346]'
                }`}
              />
              <button
                onClick={() => setBackdrop('neon')}
                title="High-Contrast Neon (reveals hidden background artifacts)"
                className={`h-8 rounded-lg border bg-[#FF0055] flex items-center justify-center transition-all cursor-pointer ${
                  backdrop === 'neon'
                    ? 'border-[#5EE0B5] ring-2 ring-[#5EE0B5]/30'
                    : 'border-[#275346]'
                }`}
              />
            </div>

            {/* Ghost Original Overlay */}
            <div className="mt-1">
              <div className="flex justify-between items-center text-xs text-[#A3C8BD] mb-1">
                <span>Original Photo Ghost Overlay</span>
                <span className="font-mono text-[#5EE0B5]">{ghostOpacity}%</span>
              </div>
              <input
                type="range"
                min="0"
                max="80"
                value={ghostOpacity}
                onChange={(e) => setGhostOpacity(Number(e.target.value))}
                className="w-full accent-[#5EE0B5] cursor-pointer"
              />
            </div>
          </div>
        </aside>

        {/* Center Canvas Viewport */}
        <main
          ref={containerRef}
          onWheel={handleWheel}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerEnter={() => setIsHoveringCanvas(true)}
          onPointerLeave={() => {
            setIsHoveringCanvas(false);
            setMagneticPreview(null);
            if (isDrawingRef.current) {
              isDrawingRef.current = false;
              pushHistory();
            }
          }}
          className={`flex-1 relative overflow-hidden flex items-center justify-center cursor-crosshair touch-none ${
            backdrop === 'checkerboard'
              ? 'bg-checkerboard'
              : backdrop === 'dark'
              ? 'bg-[#10231F]'
              : backdrop === 'light'
              ? 'bg-white'
              : 'bg-[#FF0055]'
          } ${tool === 'pan' || spacePressed ? 'cursor-grab active:cursor-grabbing' : ''}`}
        >
          {loading && (
            <div className="absolute inset-0 bg-[#0B1F1A]/80 backdrop-blur-xs flex flex-col items-center justify-center gap-3 z-30">
              <div className="w-10 h-10 border-4 border-[#5EE0B5]/20 border-t-[#5EE0B5] rounded-full animate-spin" />
              <p className="text-sm font-bold text-white">Analyzing contours and building edge map…</p>
            </div>
          )}

          {/* Top Floating Helper Banner for Smart Snap Tool */}
          {tool === 'magnetic' && (
            <div className="absolute top-3 left-1/2 -translate-x-1/2 z-30 bg-[#10231F]/90 backdrop-blur-md px-4 py-2 rounded-full border border-[#5EE0B5]/40 shadow-xl flex items-center gap-2.5 pointer-events-none">
              <div className="w-2 h-2 rounded-full bg-[#5EE0B5] animate-ping" />
              <span className="text-xs font-bold text-white tracking-wide">
                Draw loosely beside the object — line snaps to the edge automatically!
              </span>
            </div>
          )}

          {/* Interactive Zoom/Pan Transform Stage */}
          <div
            className="relative transition-transform duration-75 ease-out select-none"
            style={{
              transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
              transformOrigin: 'center center',
            }}
          >
            {/* Ghost original underlay */}
            {ghostOpacity > 0 && sourceUrl && (
              <img
                src={sourceUrl}
                alt="Original ghost"
                className="absolute inset-0 pointer-events-none select-none"
                style={{
                  width: `${imageSize.width}px`,
                  height: `${imageSize.height}px`,
                  opacity: ghostOpacity / 100,
                }}
              />
            )}

            {/* Editable Cutout Canvas */}
            <canvas
              ref={canvasRef}
              className="block shadow-2xl relative z-10"
              style={{
                width: `${imageSize.width}px`,
                height: `${imageSize.height}px`,
                imageRendering: zoom > 2 ? 'pixelated' : 'auto',
              }}
            />

            {/* Dynamic Snap Line SVG Overlay */}
            <svg
              className="absolute inset-0 z-20 pointer-events-none"
              width={imageSize.width}
              height={imageSize.height}
            >
              {/* Lasso overlay */}
              {tool === 'lasso' && lassoPoints.length > 0 && (
                <polygon
                  points={lassoPoints.map((p) => `${p.x},${p.y}`).join(' ')}
                  fill="rgba(94, 224, 181, 0.25)"
                  stroke="#5EE0B5"
                  strokeWidth={Math.max(1, 2 / zoom)}
                  strokeDasharray="4 4"
                />
              )}

              {/* Magnetic Snap Overlay */}
              {tool === 'magnetic' && (
                <>
                  {/* Real-time area to be removed (red translucent highlight) */}
                  {cutoutShape && cutoutShape.polygonPoints.length > 2 && (
                    <polygon
                      points={cutoutShape.polygonPoints.map((p) => `${p.x},${p.y}`).join(' ')}
                      fill="rgba(239, 68, 68, 0.38)"
                      stroke="rgba(239, 68, 68, 0.85)"
                      strokeWidth={Math.max(1, 1.5 / zoom)}
                      strokeDasharray="4 3"
                    />
                  )}

                  {/* Rough user stroke (amber dashed guide) */}
                  {snapPairs.length > 1 && (
                    <polyline
                      points={snapPairs.map((p) => `${p.rough.x},${p.rough.y}`).join(' ')}
                      fill="none"
                      stroke="rgba(255, 193, 7, 0.65)"
                      strokeWidth={Math.max(1, 1.5 / zoom)}
                      strokeDasharray="4 4"
                    />
                  )}

                  {/* Clean snapped contour (neon cyan solid stroke hugging the object) */}
                  {cutoutShape && cutoutShape.snappedContour.length > 1 && (
                    <polyline
                      points={cutoutShape.snappedContour.map((p) => `${p.x},${p.y}`).join(' ')}
                      fill="none"
                      stroke="#5EE0B5"
                      strokeWidth={Math.max(2.5, 3.5 / zoom)}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      style={{
                        filter: 'drop-shadow(0 0 6px rgba(94, 224, 181, 0.9))',
                      }}
                    />
                  )}

                  {/* Snapped anchor points */}
                  {cutoutShape && cutoutShape.snappedContour.map((pt, idx) => (
                    <circle
                      key={idx}
                      cx={pt.x}
                      cy={pt.y}
                      r={Math.max(2, 3 / zoom)}
                      fill="#FFFFFF"
                      stroke="#10231F"
                      strokeWidth={Math.max(1, 1.5 / zoom)}
                    />
                  ))}

                  {/* Live magnetic hover connector */}
                  {magneticPreview && magneticPreview.hasSnap && (
                    <>
                      {/* Connection ray from cursor to snapped edge */}
                      <line
                        x1={magneticPreview.rawX}
                        y1={magneticPreview.rawY}
                        x2={magneticPreview.snapX}
                        y2={magneticPreview.snapY}
                        stroke="#5EE0B5"
                        strokeWidth={Math.max(1, 1.5 / zoom)}
                        strokeDasharray="2 2"
                      />
                      {/* Snapped edge target halo */}
                      <circle
                        cx={magneticPreview.snapX}
                        cy={magneticPreview.snapY}
                        r={Math.max(4, 6 / zoom)}
                        fill="rgba(94, 224, 181, 0.4)"
                        stroke="#5EE0B5"
                        strokeWidth={Math.max(1.5, 2.5 / zoom)}
                      />
                      <circle
                        cx={magneticPreview.snapX}
                        cy={magneticPreview.snapY}
                        r={Math.max(1.5, 2 / zoom)}
                        fill="#FFFFFF"
                      />
                    </>
                  )}
                </>
              )}
            </svg>
          </div>

          {/* Floating Brush Cursor */}
          {isHoveringCanvas && cursorPos && (tool === 'erase' || tool === 'restore' || tool === 'snap_eraser') && !spacePressed && (
            <div
              className="pointer-events-none fixed z-50 rounded-full border border-white shadow-[0_0_8px_rgba(0,0,0,0.8)] -translate-x-1/2 -translate-y-1/2"
              style={{
                left: `${cursorPos.x}px`,
                top: `${cursorPos.y}px`,
                width: `${brushSize * zoom}px`,
                height: `${brushSize * zoom}px`,
                backgroundColor:
                  tool === 'restore'
                    ? 'rgba(94, 224, 181, 0.25)'
                    : tool === 'snap_eraser'
                    ? 'rgba(56, 189, 248, 0.25)'
                    : 'rgba(239, 68, 68, 0.25)',
                borderColor:
                  tool === 'restore'
                    ? '#5EE0B5'
                    : tool === 'snap_eraser'
                    ? '#38BDF8'
                    : '#EF4444',
              }}
            />
          )}

          {/* Viewport Zoom Overlay Controls */}
          <div className="absolute bottom-4 right-4 z-20 flex items-center gap-1 bg-[#10231F]/90 backdrop-blur-md p-1.5 rounded-xl border border-[#275346] shadow-xl text-white">
            <button
              onClick={() => setZoom((z) => Math.max(0.2, Math.round((z - 0.2) * 10) / 10))}
              title="Zoom out"
              className="p-1.5 hover:bg-white/10 rounded-lg transition-colors cursor-pointer"
            >
              <ZoomOut className="w-4 h-4" />
            </button>
            <span className="text-xs font-mono font-bold px-2 min-w-[52px] text-center">
              {Math.round(zoom * 100)}%
            </span>
            <button
              onClick={() => setZoom((z) => Math.min(5, Math.round((z + 0.2) * 10) / 10))}
              title="Zoom in"
              className="p-1.5 hover:bg-white/10 rounded-lg transition-colors cursor-pointer"
            >
              <ZoomIn className="w-4 h-4" />
            </button>
            <div className="w-[1px] h-4 bg-white/20 mx-1" />
            <button
              onClick={handleFitToScreen}
              title="Fit to view"
              className="p-1.5 hover:bg-white/10 rounded-lg transition-colors text-xs font-bold flex items-center gap-1 cursor-pointer"
            >
              <Maximize2 className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Fit</span>
            </button>
          </div>
        </main>
      </div>

      {/* Bottom Save & Cancel Bar */}
      <footer className="h-16 border-t border-[#22443A] bg-[#10231F] px-4 sm:px-6 flex items-center justify-between shrink-0">
        <div className="text-xs text-[#A3C8BD] flex items-center gap-2">
          <HelpCircle className="w-4 h-4 text-[#5EE0B5]" />
          <span className="hidden sm:inline">
            <strong>Smart Snap</strong>: Draw beside the object edge — it locks onto the boundary and clears leftover background automatically.
          </span>
          <span className="sm:hidden">Smart Snap Line: Auto-hugs object edge</span>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={onClose}
            className="py-2.5 px-4 rounded-xl text-sm font-bold text-white/80 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
          >
            Cancel
          </button>
          <button
            id="btn-apply-cutout-changes"
            onClick={handleSave}
            disabled={loading}
            className="py-2.5 px-6 rounded-xl text-sm font-extrabold bg-[#5EE0B5] hover:bg-[#4DD0A5] text-[#10231F] flex items-center gap-2 shadow-lg transition-all hover:scale-102 active:scale-98 disabled:opacity-50 cursor-pointer"
          >
            <Check className="w-4 h-4" />
            <span>Apply Changes</span>
          </button>
        </div>
      </footer>
    </div>
  );
};
