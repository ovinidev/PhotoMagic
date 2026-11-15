import { frameTransform, type Size } from '@shared/capture'

/**
 * The two 2D context calls this needs, with only the overloads it uses, so a test can record
 * them. A real `CanvasRenderingContext2D` satisfies it.
 */
export type FrameContext = {
  setTransform: (a: number, b: number, c: number, d: number, e: number, f: number) => void
  drawImage: (image: CanvasImageSource, dx: number, dy: number, dw: number, dh: number) => void
}

/**
 * Draws one raw camera frame rotated by `rotationDeg` and mirrored (DESIGN §5). The TV preview
 * passes its canvas size as `target` (cover fit); the still passes nothing (full resolution).
 * This is the only place a camera frame is drawn, so the preview and the file cannot disagree.
 */
export function drawCameraFrame(
  context: FrameContext,
  source: CanvasImageSource,
  sourceSize: Size,
  rotationDeg: number,
  target?: Size,
): void {
  context.setTransform(...frameTransform(sourceSize, rotationDeg, target))
  context.drawImage(source, 0, 0, sourceSize.width, sourceSize.height)
  context.setTransform(1, 0, 0, 1, 0, 0)
}
