/**
 * TV monitor choice and placement (DESIGN §3). Pure: `src/main/windows/` reads Electron's
 * `screen` and hands the list over, so Vitest covers every branch without a window.
 */
import { TV_FRAME } from './constants'

export type DisplayInfo = {
  id: number
  primary: boolean
  x: number
  y: number
  width: number
  height: number
}

export type GuestChoice =
  | { kind: 'portrait'; display: DisplayInfo }
  | { kind: 'landscape-external'; display: DisplayInfo }
  | { kind: 'missing' }

type Size = { width: number; height: number }
type Rect = Size & { x: number; y: number }

const TV_ASPECT = TV_FRAME.width / TV_FRAME.height

function isPortrait(display: Size): boolean {
  return display.height > display.width
}

/**
 * 1. Among non-primary monitors, the portrait one whose aspect ratio is closest to 9:16.
 * 2. Otherwise, the first landscape external.
 * 3. Otherwise (only the primary), `missing`.
 */
export function chooseGuestDisplay(displays: readonly DisplayInfo[]): GuestChoice {
  const externals = displays.filter((display) => !display.primary)
  let best: DisplayInfo | undefined
  let bestDistance = Number.POSITIVE_INFINITY
  for (const display of externals) {
    if (!isPortrait(display)) continue
    const distance = Math.abs(display.width / display.height - TV_ASPECT)
    if (distance < bestDistance) {
      best = display
      bestDistance = distance
    }
  }
  if (best) return { kind: 'portrait', display: best }
  const landscape = externals[0]
  if (landscape) return { kind: 'landscape-external', display: landscape }
  return { kind: 'missing' }
}

export type GuestPlacement =
  | { kind: 'show'; display: DisplayInfo }
  | { kind: 'hide'; reason: 'missing' | 'landscape' }

/**
 * Where the TV window goes after a monitor is added, removed or changed while it is open.
 * The window stays on its current monitor while that monitor is still an eligible TV, so a
 * second screen plugged in mid-party does not steal it. When no eligible monitor is left, the
 * window hides instead of falling back onto the laptop screen.
 */
export function placeGuestWindow(input: {
  displays: readonly DisplayInfo[]
  currentDisplayId: number | null
  allowLandscape: boolean
}): GuestPlacement {
  const { displays, currentDisplayId, allowLandscape } = input
  const current = displays.find((display) => display.id === currentDisplayId && !display.primary)
  if (current && (isPortrait(current) || allowLandscape)) return { kind: 'show', display: current }

  const choice = chooseGuestDisplay(displays)
  switch (choice.kind) {
    case 'portrait':
      return { kind: 'show', display: choice.display }
    case 'landscape-external':
      return allowLandscape ? { kind: 'show', display: choice.display } : { kind: 'hide', reason: 'landscape' }
    case 'missing':
      return { kind: 'hide', reason: 'missing' }
  }
}

/**
 * Zoom applied to the TV page so its CSS, written for the 1080×1920 logical frame, keeps the
 * same proportions (and the 64 px targets) on a monitor that reports another size.
 */
export function tvZoomFactor(display: Size): number {
  return Math.min(display.width / TV_FRAME.width, display.height / TV_FRAME.height)
}

/** Top-left corner that centers a window of `size` inside `area`, clamped to the area's origin. */
export function centerIn(area: Rect, size: Size): { x: number; y: number } {
  return {
    x: area.x + Math.max(0, Math.round((area.width - size.width) / 2)),
    y: area.y + Math.max(0, Math.round((area.height - size.height) / 2)),
  }
}
