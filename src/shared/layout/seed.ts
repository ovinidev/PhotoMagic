import type { Layouts, Slot } from './types'

/**
 * Two-strip seed on first run (PRD §6.2): the briefing numbers without Cima 3's demo leftover
 * (Angle 0, Top 194) and with Baixo 2 moved to 620 so it does not overlap Baixo 1. A working
 * assumption until the client measures the gray squares; the operator can still move every slot.
 */
export const TWO_STRIPS_SEED: readonly Slot[] = [
  { id: 'top-1', photo: 1, left: 72, top: 70, width: 500, height: 281, angle: 270 },
  { id: 'top-2', photo: 2, left: 403, top: 70, width: 500, height: 281, angle: 270 },
  { id: 'top-3', photo: 3, left: 734, top: 70, width: 500, height: 281, angle: 270 },
  { id: 'bottom-1', photo: 1, left: 72, top: 670, width: 500, height: 281, angle: 0 },
  { id: 'bottom-2', photo: 2, left: 620, top: 670, width: 500, height: 281, angle: 0 },
]

/**
 * One-strip seed (PRD §6.2): three portraits side by side covering the whole sheet, 42 px side and
 * 40 px top/bottom margins, 40 px gaps. Pending validation: not measured on any artwork.
 */
export const ONE_STRIP_SEED: readonly Slot[] = [
  { id: 'photo-1', photo: 1, left: 42, top: 40, width: 560, height: 1160, angle: 0 },
  { id: 'photo-2', photo: 2, left: 642, top: 40, width: 560, height: 1160, angle: 0 },
  { id: 'photo-3', photo: 3, left: 1242, top: 40, width: 560, height: 1160, angle: 0 },
]

export const SEED_LAYOUTS: Layouts = {
  'two-strips': TWO_STRIPS_SEED,
  'one-strip': ONE_STRIP_SEED,
}
