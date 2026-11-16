/**
 * Zoom of the editor's sheet (DESIGN §7). 1 fits the whole sheet in the viewport; the sheet is laid
 * out at `fit × zoom` CSS pixels (never a CSS transform), so the pointer → sheet conversion in
 * `SheetCanvas` stays exact at any zoom.
 */
export const CANVAS_ZOOM = { min: 1, max: 4, step: 1.25 } as const

const round3 = (value: number) => Math.round(value * 1000) / 1000

export function clampCanvasZoom(zoom: number): number {
  if (!Number.isFinite(zoom)) return CANVAS_ZOOM.min
  return round3(Math.min(CANVAS_ZOOM.max, Math.max(CANVAS_ZOOM.min, zoom)))
}

/** One button or wheel notch in or out. */
export function stepCanvasZoom(zoom: number, direction: 'in' | 'out'): number {
  return clampCanvasZoom(direction === 'in' ? zoom * CANVAS_ZOOM.step : zoom / CANVAS_ZOOM.step)
}

/** The sheet width that fits a viewport at zoom 1, keeping the 1844×1240 proportion. */
export function fitSheetWidth(viewport: { width: number; height: number }, sheet: { width: number; height: number }): number {
  const width = Math.max(0, viewport.width)
  const height = Math.max(0, viewport.height)
  return Math.floor(Math.min(width, (height * sheet.width) / sheet.height))
}

/**
 * The scroll offset that keeps the content point under `anchor` (viewport coordinates) in place
 * when zooming from `from` to `to`: zoom toward the cursor, like a map.
 */
export function scrollForZoom(scroll: number, anchor: number, from: number, to: number): number {
  if (from <= 0) return scroll
  return Math.max(0, ((scroll + anchor) * to) / from - anchor)
}
