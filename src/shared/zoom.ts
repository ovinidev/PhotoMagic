/**
 * Laptop window zoom (DESIGN §3): an automatic factor that grows with the window, times the
 * operator's own zoom (Ctrl + / Ctrl − / Ctrl 0, Ctrl + wheel, the +/− buttons). Pure: main applies
 * the product with `webContents.setZoomFactor` on the laptop window only; the TV is never zoomed.
 */

/** The window content size, in DIP, the laptop UI was drawn for: zoom 1 up to this size. */
export const ZOOM_REFERENCE = { width: 1280, height: 760 } as const
/** The automatic factor never shrinks the UI and stops growing at twice the reference. */
export const AUTO_ZOOM_RANGE = { min: 1, max: 2 } as const
/** The operator's zoom steps, as in a browser. 1 is `Ctrl 0`. */
export const USER_ZOOM_STEPS = [0.67, 0.75, 0.8, 0.9, 1, 1.1, 1.25, 1.5, 1.75, 2] as const
export const DEFAULT_USER_ZOOM = 1

export type ZoomStep = 'in' | 'out' | 'reset'

const round2 = (value: number) => Math.round(value * 100) / 100

/**
 * The automatic factor for a window content size: the smaller of the width and height ratios to the
 * reference, so the whole page grows without overflowing, clamped to `AUTO_ZOOM_RANGE`. A 1366×768
 * screen stays at 1; a maximized 1920×1080 window is about 1.3.
 */
export function autoZoom(content: { width: number; height: number }): number {
  if (!(content.width > 0) || !(content.height > 0)) return AUTO_ZOOM_RANGE.min
  const ratio = Math.min(content.width / ZOOM_REFERENCE.width, content.height / ZOOM_REFERENCE.height)
  return round2(Math.min(AUTO_ZOOM_RANGE.max, Math.max(AUTO_ZOOM_RANGE.min, ratio)))
}

/** The nearest step at or around `current`, so a hand-edited config still steps sensibly. */
function nearestStepIndex(current: number): number {
  let best = 0
  USER_ZOOM_STEPS.forEach((step, index) => {
    if (Math.abs(step - current) < Math.abs(USER_ZOOM_STEPS[best]! - current)) best = index
  })
  return best
}

/** The operator's zoom after one step; stops at the first and last steps. */
export function stepUserZoom(current: number, step: ZoomStep): number {
  if (step === 'reset') return DEFAULT_USER_ZOOM
  const index = nearestStepIndex(current)
  const next = step === 'in' ? Math.min(USER_ZOOM_STEPS.length - 1, index + 1) : Math.max(0, index - 1)
  return USER_ZOOM_STEPS[next]!
}

/** A stored zoom that is not a number in the steps' range falls back to 1. */
export function sanitizeUserZoom(value: unknown): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return DEFAULT_USER_ZOOM
  if (value < USER_ZOOM_STEPS[0] || value > USER_ZOOM_STEPS[USER_ZOOM_STEPS.length - 1]!) return DEFAULT_USER_ZOOM
  return value
}

/** What the laptop window shows: the automatic factor times the operator's zoom. */
export function effectiveZoom(auto: number, user: number): number {
  return round2(auto * user)
}
