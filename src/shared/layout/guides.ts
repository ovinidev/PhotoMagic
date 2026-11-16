import { slotBounds, type Rect } from './geometry'
import { SEED_LAYOUTS } from './seed'
import type { PrintMode } from './types'

/** One standard photo box of a mode, as the sheet shows it: axis-aligned, with its corner radius. */
export type GuideBox = { id: string; rect: Rect; radius: number }

/**
 * The standard photo boxes of a mode (PRD §6.2): where the photos go by default, drawn as gray guides
 * in the editor and on the create-event preview. The client's background art usually comes without
 * boxes (often plain white), so these come from the seed, never from the template: 2 tiras is the
 * client's measured boxes (3 portrait on top, 2 landscape below), 1 tira its 3 portrait boxes.
 * They do not follow the operator's edits, so they keep showing where the standard boxes are.
 */
export function guideBoxes(mode: PrintMode): readonly GuideBox[] {
  return SEED_LAYOUTS[mode].map((slot) => ({ id: slot.id, rect: slotBounds(slot), radius: slot.radius ?? 0 }))
}
