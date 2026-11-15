/**
 * Camera frame geometry (DESIGN §5). One transform, used by the TV preview and by the saved still:
 * 1. the raw landscape sensor frame,
 * 2. rotated clockwise by `CAMERA_ROTATION_DEG` to stand the person upright,
 * 3. mirrored horizontally, so the guest sees themselves as in a mirror.
 *
 * Coordinates are canvas pixels: x grows right, y grows down, so a positive angle is clockwise.
 * Matrices use the canvas `setTransform(a, b, c, d, e, f)` order:
 * x' = a·x + c·y + e, y' = b·x + d·y + f.
 */

export type Size = { width: number; height: number }
export type Point = { x: number; y: number }
export type Matrix = readonly [a: number, b: number, c: number, d: number, e: number, f: number]
export type QuarterTurn = 0 | 90 | 180 | 270

/** Folds any multiple of 90 into 0, 90, 180 or 270. Other angles are a programming error. */
export function normalizeRotation(degrees: number): QuarterTurn {
  if (!Number.isInteger(degrees) || degrees % 90 !== 0) {
    throw new RangeError(`Camera rotation must be a multiple of 90°, got ${degrees}`)
  }
  return (((degrees % 360) + 360) % 360) as QuarterTurn
}

/** Size of the frame after the rotation: width and height swap on a quarter turn. */
export function orientedSize(source: Size, rotationDeg: number): Size {
  const turn = normalizeRotation(rotationDeg)
  return turn === 90 || turn === 270
    ? { width: source.height, height: source.width }
    : { width: source.width, height: source.height }
}

/** `outer ∘ inner`: the matrix that applies `inner` first, then `outer`. */
export function multiply(outer: Matrix, inner: Matrix): Matrix {
  const [a1, b1, c1, d1, e1, f1] = outer
  const [a2, b2, c2, d2, e2, f2] = inner
  return [
    a1 * a2 + c1 * b2,
    b1 * a2 + d1 * b2,
    a1 * c2 + c1 * d2,
    b1 * c2 + d1 * d2,
    a1 * e2 + c1 * f2 + e1,
    b1 * e2 + d1 * f2 + f1,
  ]
}

export function applyMatrix(matrix: Matrix, point: Point): Point {
  const [a, b, c, d, e, f] = matrix
  return { x: a * point.x + c * point.y + e, y: b * point.x + d * point.y + f }
}

// Exact integers for quarter turns: no 6e-17 from Math.cos(Math.PI / 2).
const COS: Record<QuarterTurn, number> = { 0: 1, 90: 0, 180: -1, 270: 0 }
const SIN: Record<QuarterTurn, number> = { 0: 0, 90: 1, 180: 0, 270: -1 }

/**
 * Maps the raw sensor frame onto the upright, mirrored frame at 1:1, with the result's
 * top-left corner at the origin. Size of the result: `orientedSize(source, rotationDeg)`.
 */
export function orientationMatrix(source: Size, rotationDeg: number): Matrix {
  const turn = normalizeRotation(rotationDeg)
  const cos = COS[turn]
  const sin = SIN[turn]
  const rotate: Matrix = [cos, sin, -sin, cos, 0, 0]

  const corners = [
    { x: 0, y: 0 },
    { x: source.width, y: 0 },
    { x: 0, y: source.height },
    { x: source.width, y: source.height },
  ].map((corner) => applyMatrix(rotate, corner))
  const minX = Math.min(...corners.map((corner) => corner.x))
  const minY = Math.min(...corners.map((corner) => corner.y))
  const toOrigin: Matrix = [1, 0, 0, 1, -minX, -minY]

  const out = orientedSize(source, turn)
  const mirror: Matrix = [-1, 0, 0, 1, out.width, 0]

  return clean(multiply(mirror, multiply(toOrigin, rotate)))
}

export type CoverFit = { scale: number; x: number; y: number }

/**
 * Scales `content` to cover `box` and centers it: the excess is cropped in equal parts on the
 * axis that overflows. `x` and `y` are the content's top-left corner inside the box.
 */
export function coverFit(content: Size, box: Size): CoverFit {
  const scale = Math.max(box.width / content.width, box.height / content.height)
  return {
    scale,
    x: (box.width - content.width * scale) / 2,
    y: (box.height - content.height * scale) / 2,
  }
}

/**
 * The transform for drawing a raw camera frame. Without `target`, the upright mirrored frame
 * at full resolution (the still). With `target`, the same frame cover-fitted into it (the
 * preview canvas). Both go through `orientationMatrix`: there is no second path.
 */
export function frameTransform(source: Size, rotationDeg: number, target?: Size): Matrix {
  const orient = orientationMatrix(source, rotationDeg)
  if (!target) return orient
  const fit = coverFit(orientedSize(source, rotationDeg), target)
  return clean(multiply([fit.scale, 0, 0, fit.scale, fit.x, fit.y], orient))
}

/** Turns -0 into 0 so matrices compare and serialize cleanly. */
function clean(matrix: Matrix): Matrix {
  return matrix.map((value) => (Object.is(value, -0) ? 0 : value)) as unknown as Matrix
}

