/**
 * Edge Snapping & Magnetic Contour Detection Utilities
 * Detects image edges using Sobel RGB color contrast and Alpha transitions,
 * enabling automatic snapping to object contours and precise boundary-constrained cutouts.
 */

export interface EdgeMapData {
  edgeMap: Uint8Array;
  width: number;
  height: number;
}

export interface SnapPointPair {
  rough: { x: number; y: number };
  snapped: { x: number; y: number };
}

export interface CutoutShapeResult {
  polygonPoints: Array<{ x: number; y: number }>;
  snappedContour: Array<{ x: number; y: number }>;
  isClosed: boolean;
}

/**
 * Builds a multi-channel edge gradient map from canvas ImageData.
 * Computes RGB color Sobel gradients and Alpha boundary transitions.
 */
export function buildEdgeMap(
  colorCanvas: HTMLCanvasElement,
  alphaCanvas?: HTMLCanvasElement | null
): EdgeMapData {
  const width = colorCanvas.width;
  const height = colorCanvas.height;
  const edgeMap = new Uint8Array(width * height);

  if (width === 0 || height === 0) {
    return { edgeMap, width, height };
  }

  try {
    const colorCtx = colorCanvas.getContext('2d', { willReadFrequently: true });
    if (!colorCtx) return { edgeMap, width, height };

    const colorImgData = colorCtx.getImageData(0, 0, width, height);
    const colorData = colorImgData.data;

    let alphaData: Uint8ClampedArray | null = null;
    if (alphaCanvas && alphaCanvas.width === width && alphaCanvas.height === height) {
      const alphaCtx = alphaCanvas.getContext('2d', { willReadFrequently: true });
      if (alphaCtx) {
        alphaData = alphaCtx.getImageData(0, 0, width, height).data;
      }
    }

    const rArr = new Uint8Array(width * height);
    const gArr = new Uint8Array(width * height);
    const bArr = new Uint8Array(width * height);
    const aArr = new Uint8Array(width * height);

    for (let i = 0; i < width * height; i++) {
      const idx = i * 4;
      rArr[i] = colorData[idx];
      gArr[i] = colorData[idx + 1];
      bArr[i] = colorData[idx + 2];
      aArr[i] = alphaData ? alphaData[idx + 3] : colorData[idx + 3];
    }

    // Multi-channel Sobel convolution
    for (let y = 1; y < height - 1; y++) {
      const rowOffset = y * width;
      const prevRow = (y - 1) * width;
      const nextRow = (y + 1) * width;

      for (let x = 1; x < width - 1; x++) {
        // Red channel gradient
        const gxR =
          -rArr[prevRow + x - 1] + rArr[prevRow + x + 1] +
          -2 * rArr[rowOffset + x - 1] + 2 * rArr[rowOffset + x + 1] +
          -rArr[nextRow + x - 1] + rArr[nextRow + x + 1];
        const gyR =
          -rArr[prevRow + x - 1] - 2 * rArr[prevRow + x] - rArr[prevRow + x + 1] +
          rArr[nextRow + x - 1] + 2 * rArr[nextRow + x] + rArr[nextRow + x + 1];

        // Green channel gradient
        const gxG =
          -gArr[prevRow + x - 1] + gArr[prevRow + x + 1] +
          -2 * gArr[rowOffset + x - 1] + 2 * gArr[rowOffset + x + 1] +
          -gArr[nextRow + x - 1] + gArr[nextRow + x + 1];
        const gyG =
          -gArr[prevRow + x - 1] - 2 * gArr[prevRow + x] - gArr[prevRow + x + 1] +
          gArr[nextRow + x - 1] + 2 * gArr[nextRow + x] + gArr[nextRow + x + 1];

        // Blue channel gradient
        const gxB =
          -bArr[prevRow + x - 1] + bArr[prevRow + x + 1] +
          -2 * bArr[rowOffset + x - 1] + 2 * bArr[rowOffset + x + 1] +
          -bArr[nextRow + x - 1] + bArr[nextRow + x + 1];
        const gyB =
          -bArr[prevRow + x - 1] - 2 * bArr[prevRow + x] - bArr[prevRow + x + 1] +
          bArr[nextRow + x - 1] + 2 * bArr[nextRow + x] + bArr[nextRow + x + 1];

        // Alpha channel gradient (dominant for cutout boundary)
        const gxA =
          -aArr[prevRow + x - 1] + aArr[prevRow + x + 1] +
          -2 * aArr[rowOffset + x - 1] + 2 * aArr[rowOffset + x + 1] +
          -aArr[nextRow + x - 1] + aArr[nextRow + x + 1];
        const gyA =
          -aArr[prevRow + x - 1] - 2 * aArr[prevRow + x] - aArr[prevRow + x + 1] +
          aArr[nextRow + x - 1] + 2 * aArr[nextRow + x] + aArr[nextRow + x + 1];

        const magR = Math.abs(gxR) + Math.abs(gyR);
        const magG = Math.abs(gxG) + Math.abs(gyG);
        const magB = Math.abs(gxB) + Math.abs(gyB);
        const magColor = Math.max(magR, magG, magB);
        const magAlpha = Math.abs(gxA) + Math.abs(gyA);

        const total = Math.min(255, (magColor >> 2) + (magAlpha >> 1));
        edgeMap[rowOffset + x] = total;
      }
    }
  } catch {
    // Canvas read fallback
  }

  return { edgeMap, width, height };
}

/**
 * Finds the strongest edge point in a radius R around (targetX, targetY).
 * Snaps cursor coordinates to the nearest object contour.
 */
export function findSnappedEdgePoint(
  targetX: number,
  targetY: number,
  edgeData: EdgeMapData,
  searchRadius: number = 32
): { x: number; y: number; strength: number; hasSnap: boolean } {
  const { edgeMap, width, height } = edgeData;
  const x0 = Math.round(targetX);
  const y0 = Math.round(targetY);

  if (width === 0 || height === 0 || x0 < 0 || x0 >= width || y0 < 0 || y0 >= height) {
    return { x: targetX, y: targetY, strength: 0, hasSnap: false };
  }

  const r = Math.max(8, Math.min(64, Math.round(searchRadius)));
  const minX = Math.max(1, x0 - r);
  const maxX = Math.min(width - 2, x0 + r);
  const minY = Math.max(1, y0 - r);
  const maxY = Math.min(height - 2, y0 + r);

  let bestX = targetX;
  let bestY = targetY;
  let bestScore = -1;
  let maxStrength = 0;

  for (let cy = minY; cy <= maxY; cy++) {
    const rowIdx = cy * width;
    for (let cx = minX; cx <= maxX; cx++) {
      const edgeVal = edgeMap[rowIdx + cx];
      if (edgeVal < 18) continue;

      const dist = Math.hypot(cx - targetX, cy - targetY);
      if (dist > r) continue;

      const score = edgeVal * (1 - (dist / r) * 0.42);

      if (score > bestScore) {
        bestScore = score;
        bestX = cx;
        bestY = cy;
        maxStrength = edgeVal;
      }
    }
  }

  const hasSnap = bestScore > 20;

  return {
    x: hasSnap ? bestX : targetX,
    y: hasSnap ? bestY : targetY,
    strength: maxStrength,
    hasSnap,
  };
}

/**
 * Smooths an array of points using a 3-point moving average to produce clean contours.
 */
export function smoothPoints(
  points: Array<{ x: number; y: number }>
): Array<{ x: number; y: number }> {
  if (points.length < 3) return points;
  const smoothed: Array<{ x: number; y: number }> = [];

  for (let i = 0; i < points.length; i++) {
    if (i === 0 || i === points.length - 1) {
      smoothed.push({ x: points[i].x, y: points[i].y });
    } else {
      const prev = points[i - 1];
      const curr = points[i];
      const next = points[i + 1];
      smoothed.push({
        x: prev.x * 0.25 + curr.x * 0.5 + next.x * 0.25,
        y: prev.y * 0.25 + curr.y * 0.5 + next.y * 0.25,
      });
    }
  }

  return smoothed;
}

/**
 * Computes the exact polygon and boundary regions to be cut/removed.
 * CRITICAL FIX: Computes a globally consistent normal orientation across the entire curve,
 * preventing individual per-point normal flipping that caused knots, self-intersections,
 * and puncturing into the subject.
 */
export function computeCutoutShape(
  pairs: SnapPointPair[],
  clearWidth: number = 45,
  invertSide: boolean = false,
  forceClosed: boolean = false
): CutoutShapeResult | null {
  if (pairs.length < 2) return null;

  // Extract raw snapped points and smooth them for sub-pixel contour fidelity
  const rawSnapped = pairs.map((p) => p.snapped);
  const smoothedSnapped = smoothPoints(rawSnapped);
  const N = smoothedSnapped.length;

  if (N < 2) return null;

  // Check if user drew a closed loop (e.g. circling leftover background between arms or torso)
  const firstSnapped = smoothedSnapped[0];
  const lastSnapped = smoothedSnapped[N - 1];
  const firstRough = pairs[0].rough;
  const lastRough = pairs[pairs.length - 1].rough;

  const snapCloseDist = Math.hypot(firstSnapped.x - lastSnapped.x, firstSnapped.y - lastSnapped.y);
  const roughCloseDist = Math.hypot(firstRough.x - lastRough.x, firstRough.y - lastRough.y);

  const isClosed = forceClosed || (pairs.length >= 4 && (snapCloseDist < 36 || roughCloseDist < 40));

  if (isClosed) {
    return {
      polygonPoints: smoothedSnapped,
      snappedContour: smoothedSnapped,
      isClosed: true,
    };
  }

  // 1. Calculate tangent vectors along the snapped curve
  const tangents: Array<{ ux: number; uy: number }> = [];
  for (let i = 0; i < N; i++) {
    let tx = 0;
    let ty = 0;
    if (i === 0) {
      tx = smoothedSnapped[1].x - smoothedSnapped[0].x;
      ty = smoothedSnapped[1].y - smoothedSnapped[0].y;
    } else if (i === N - 1) {
      tx = smoothedSnapped[N - 1].x - smoothedSnapped[N - 2].x;
      ty = smoothedSnapped[N - 1].y - smoothedSnapped[N - 2].y;
    } else {
      tx = smoothedSnapped[i + 1].x - smoothedSnapped[i - 1].x;
      ty = smoothedSnapped[i + 1].y - smoothedSnapped[i - 1].y;
    }

    const tLen = Math.hypot(tx, ty);
    if (tLen > 0.001) {
      tangents.push({ ux: tx / tLen, uy: ty / tLen });
    } else {
      tangents.push({ ux: 0, uy: 1 });
    }
  }

  // 2. CRITICAL FIX: Determine GLOBAL dominant side (left vs right) over the entire stroke
  // This guarantees all normals point to the SAME side with zero flips or twists!
  let globalDotScore = 0;
  for (let i = 0; i < N; i++) {
    const s = smoothedSnapped[i];
    const r = pairs[i].rough;
    const t = tangents[i];
    // Candidate normal A (-uy, ux)
    const nAx = -t.uy;
    const nAy = t.ux;
    const vx = r.x - s.x;
    const vy = r.y - s.y;
    globalDotScore += vx * nAx + vy * nAy;
  }

  // Dominant normal choice across the entire line
  const useNormalA = globalDotScore >= 0;

  // 3. Construct smooth outer points along the background side
  const rawOuter: Array<{ x: number; y: number }> = [];
  const expandReach = Math.max(25, clearWidth);

  for (let i = 0; i < N; i++) {
    const s = smoothedSnapped[i];
    const t = tangents[i];
    const nAx = -t.uy;
    const nAy = t.ux;

    let nx = useNormalA ? nAx : -nAx;
    let ny = useNormalA ? nAy : -nAy;

    if (invertSide) {
      nx = -nx;
      ny = -ny;
    }

    const px = s.x + nx * expandReach;
    const py = s.y + ny * expandReach;
    rawOuter.push({ x: px, y: py });
  }

  // Smooth outer points for fluid, natural boundary
  const smoothedOuter = smoothPoints(rawOuter);

  // 4. Construct solid ribbon polygon:
  // S_0 -> S_1 -> ... -> S_{N-1} -> P_{N-1} -> ... -> P_1 -> P_0
  const polygonPoints: Array<{ x: number; y: number }> = [
    ...smoothedSnapped,
    ...smoothedOuter.slice().reverse(),
  ];

  return {
    polygonPoints,
    snappedContour: smoothedSnapped,
    isClosed: false,
  };
}

/**
 * Executes the cutout on canvas: cleanly removes leftover background
 * up to the exact snapped object edge, leaving the subject completely untouched.
 */
export function executeSnapCutout(
  ctx: CanvasRenderingContext2D,
  pairs: SnapPointPair[],
  clearWidth: number = 45,
  invertSide: boolean = false,
  forceClosed: boolean = false
): void {
  const shape = computeCutoutShape(pairs, clearWidth, invertSide, forceClosed);
  if (!shape || shape.polygonPoints.length < 3) return;

  ctx.save();
  ctx.globalCompositeOperation = 'destination-out';
  ctx.beginPath();
  ctx.moveTo(shape.polygonPoints[0].x, shape.polygonPoints[0].y);
  for (let i = 1; i < shape.polygonPoints.length; i++) {
    ctx.lineTo(shape.polygonPoints[i].x, shape.polygonPoints[i].y);
  }
  ctx.closePath();
  ctx.fillStyle = '#000000';
  ctx.fill();
  ctx.restore();
}

/**
 * Smart Background Color Eraser:
 * Erases only pixels matching the sampled background color within tolerance.
 * Automatically stops and preserves pixels that belong to the subject!
 */
export function eraseMatchingColorBrush(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  radius: number,
  targetColor: { r: number; g: number; b: number },
  tolerance: number = 30
): void {
  const width = ctx.canvas.width;
  const height = ctx.canvas.height;

  const minX = Math.max(0, Math.floor(cx - radius));
  const maxX = Math.min(width - 1, Math.ceil(cx + radius));
  const minY = Math.max(0, Math.floor(cy - radius));
  const maxY = Math.min(height - 1, Math.ceil(cy + radius));
  const boxW = maxX - minX + 1;
  const boxH = maxY - minY + 1;

  if (boxW <= 0 || boxH <= 0) return;

  const imgData = ctx.getImageData(minX, minY, boxW, boxH);
  const data = imgData.data;
  const tolSq = (tolerance * 2.55) ** 2;
  const radSq = radius * radius;
  let changed = false;

  for (let py = 0; py < boxH; py++) {
    const actualY = minY + py;
    const dy = actualY - cy;
    const rowOffset = py * boxW;

    for (let px = 0; px < boxW; px++) {
      const actualX = minX + px;
      const dx = actualX - cx;
      const distSq = dx * dx + dy * dy;

      if (distSq > radSq) continue;

      const idx = (rowOffset + px) * 4;
      const curA = data[idx + 3];
      if (curA === 0) continue;

      const curR = data[idx];
      const curG = data[idx + 1];
      const curB = data[idx + 2];

      const colorDiffSq =
        (curR - targetColor.r) ** 2 +
        (curG - targetColor.g) ** 2 +
        (curB - targetColor.b) ** 2;

      if (colorDiffSq <= tolSq) {
        // Feather near outer radius for soft, clean edge
        const distRatio = Math.sqrt(distSq) / radius;
        if (distRatio > 0.85) {
          const factor = (1 - distRatio) / 0.15;
          data[idx + 3] = Math.round(curA * (1 - factor));
        } else {
          data[idx + 3] = 0;
        }
        changed = true;
      }
    }
  }

  if (changed) {
    ctx.putImageData(imgData, minX, minY);
  }
}
