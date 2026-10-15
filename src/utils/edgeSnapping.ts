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
  quads: Array<Array<{ x: number; y: number }>>;
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

    // Extract R, G, B, and Alpha into flat 8-bit arrays
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

        // Alpha channel gradient (vital for cutout boundaries)
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

        // Alpha transitions are dominant if present; otherwise strong RGB color contrast
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

      // Score prioritizes high gradient magnitude while gently penalizing distance
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
 * Guarantees that the cut is strictly bounded on the object side by the snapped contour,
 * while expanding safely outward into the leftover background side.
 */
export function computeCutoutShape(
  pairs: SnapPointPair[],
  clearWidth: number = 40,
  invertSide: boolean = false
): CutoutShapeResult | null {
  if (pairs.length < 2) return null;

  // Extract raw snapped points and smooth them for sub-pixel contour fidelity
  const rawSnapped = pairs.map((p) => p.snapped);
  const smoothedSnapped = smoothPoints(rawSnapped);

  // Check if user drew a closed loop (e.g. circling leftover background between arms or torso)
  const firstSnapped = smoothedSnapped[0];
  const lastSnapped = smoothedSnapped[smoothedSnapped.length - 1];
  const firstRough = pairs[0].rough;
  const lastRough = pairs[pairs.length - 1].rough;

  const snapCloseDist = Math.hypot(firstSnapped.x - lastSnapped.x, firstSnapped.y - lastSnapped.y);
  const roughCloseDist = Math.hypot(firstRough.x - lastRough.x, firstRough.y - lastRough.y);

  const isClosed = pairs.length >= 4 && (snapCloseDist < 36 || roughCloseDist < 40);

  if (isClosed) {
    return {
      polygonPoints: smoothedSnapped,
      snappedContour: smoothedSnapped,
      isClosed: true,
      quads: [],
    };
  }

  // Open stroke along object edge:
  // Construct the outward boundary in the direction of the leftover background where the user drew
  const outerPoints: Array<{ x: number; y: number }> = [];
  const quads: Array<Array<{ x: number; y: number }>> = [];
  const N = smoothedSnapped.length;

  for (let i = 0; i < N; i++) {
    const s = smoothedSnapped[i];
    const r = pairs[i].rough;

    // Tangent along the snapped contour
    let tx = 0;
    let ty = 0;
    if (i === 0) {
      tx = smoothedSnapped[1].x - s.x;
      ty = smoothedSnapped[1].y - s.y;
    } else if (i === N - 1) {
      tx = s.x - smoothedSnapped[N - 2].x;
      ty = s.y - smoothedSnapped[N - 2].y;
    } else {
      tx = smoothedSnapped[i + 1].x - smoothedSnapped[i - 1].x;
      ty = smoothedSnapped[i + 1].y - smoothedSnapped[i - 1].y;
    }

    const tLen = Math.hypot(tx, ty);
    let ux = 0;
    let uy = 1;
    if (tLen > 0.001) {
      ux = tx / tLen;
      uy = ty / tLen;
    }

    // Candidate normals perpendicular to contour tangent
    const nAx = -uy;
    const nAy = ux;
    const nBx = uy;
    const nBy = -ux;

    // Vector from snapped point towards user's rough point (into leftover background)
    const vx = r.x - s.x;
    const vy = r.y - s.y;
    const dotA = vx * nAx + vy * nAy;

    let chosenNx = dotA >= 0 ? nAx : nBx;
    let chosenNy = dotA >= 0 ? nAy : nBy;

    if (invertSide) {
      chosenNx = -chosenNx;
      chosenNy = -chosenNy;
    }

    // Distance to expand into background:
    // User hand distance plus safety clearance
    const handDist = Math.hypot(vx, vy);
    const expandDist = Math.max(handDist + clearWidth * 0.6, clearWidth * 1.1);

    const px = s.x + chosenNx * expandDist;
    const py = s.y + chosenNy * expandDist;
    outerPoints.push({ x: px, y: py });
  }

  // Construct individual convex quadrilaterals for solid, seamless coverage
  for (let i = 0; i < N - 1; i++) {
    const s0 = smoothedSnapped[i];
    const s1 = smoothedSnapped[i + 1];
    const p1 = outerPoints[i + 1];
    const p0 = outerPoints[i];
    quads.push([s0, s1, p1, p0]);
  }

  // Overall outer perimeter polygon:
  // S_0 -> S_1 -> ... -> S_N -> P_N -> P_{N-1} -> ... -> P_0
  const polygonPoints: Array<{ x: number; y: number }> = [
    ...smoothedSnapped,
    ...outerPoints.slice().reverse(),
  ];

  return {
    polygonPoints,
    snappedContour: smoothedSnapped,
    isClosed: false,
    quads,
  };
}

/**
 * Executes the cutout on canvas: cleanly removes leftover background
 * up to the exact snapped object edge, leaving the subject untouched.
 */
export function executeSnapCutout(
  ctx: CanvasRenderingContext2D,
  pairs: SnapPointPair[],
  clearWidth: number = 40,
  invertSide: boolean = false
): void {
  const shape = computeCutoutShape(pairs, clearWidth, invertSide);
  if (!shape) return;

  ctx.save();
  ctx.globalCompositeOperation = 'destination-out';

  if (shape.isClosed) {
    // Erase inside the closed loop
    ctx.beginPath();
    ctx.moveTo(shape.snappedContour[0].x, shape.snappedContour[0].y);
    for (let i = 1; i < shape.snappedContour.length; i++) {
      ctx.lineTo(shape.snappedContour[i].x, shape.snappedContour[i].y);
    }
    ctx.closePath();
    ctx.fillStyle = '#000000';
    ctx.fill();
  } else {
    // Fill each segment quad between snapped contour and outer perimeter
    // Guarantees zero missed pixels along curves
    for (const quad of shape.quads) {
      ctx.beginPath();
      ctx.moveTo(quad[0].x, quad[0].y);
      ctx.lineTo(quad[1].x, quad[1].y);
      ctx.lineTo(quad[2].x, quad[2].y);
      ctx.lineTo(quad[3].x, quad[3].y);
      ctx.closePath();
      ctx.fillStyle = '#000000';
      ctx.fill();
    }

    // Fill the master polygon
    ctx.beginPath();
    ctx.moveTo(shape.polygonPoints[0].x, shape.polygonPoints[0].y);
    for (let i = 1; i < shape.polygonPoints.length; i++) {
      ctx.lineTo(shape.polygonPoints[i].x, shape.polygonPoints[i].y);
    }
    ctx.closePath();
    ctx.fillStyle = '#000000';
    ctx.fill();

    // Clean outer background margin circles to smoothly clear outward remnants
    // (Notice these are strictly on outer points far into the background, NEVER touching the snapped edge)
    const radius = Math.max(16, clearWidth * 0.45);
    for (let i = 0; i < shape.polygonPoints.length / 2; i++) {
      const p = shape.polygonPoints[shape.polygonPoints.length - 1 - i];
      ctx.beginPath();
      ctx.arc(p.x, p.y, radius, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  ctx.restore();
}

/**
 * Clips the canvas context so a brush centered at (cx, cy)
 * cannot cut past an edge at (snapX, snapY).
 */
export function applyEdgeBarrier(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  snapX: number,
  snapY: number,
  radius: number
): void {
  const dx = cx - snapX;
  const dy = cy - snapY;
  const dist = Math.hypot(dx, dy);
  if (dist < 0.1) return;

  const nx = dx / dist;
  const ny = dy / dist;
  const tx = -ny;
  const ty = nx;
  const M = Math.max(radius * 4, 100);

  ctx.beginPath();
  // Half plane on the brush side of the tangent through (snapX, snapY)
  ctx.moveTo(snapX + tx * M, snapY + ty * M);
  ctx.lineTo(snapX - tx * M, snapY - ty * M);
  ctx.lineTo(snapX - tx * M + nx * M, snapY - ty * M + ny * M);
  ctx.lineTo(snapX + tx * M + nx * M, snapY + ty * M + ny * M);
  ctx.closePath();
  ctx.clip();
}
