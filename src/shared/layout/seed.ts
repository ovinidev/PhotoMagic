import type { Layouts, Slot } from './types'

/**
 * Corner radius of the client's black boxes, measured from the anti-aliased coverage of all 20
 * corners: 31.1 to 35.3 px (about 33). The seed clips 1 px under the smallest, so the photo's
 * anti-aliased rounded edge always lies past the black one: no black shows (a render test over the
 * artwork counts zero dark pixels in every box), and the photo sticks out by at most about 2 px of
 * white at the roundest corner, which the eye does not see.
 */
export const CLIENT_BOX_RADIUS = 30

/**
 * Two-strip seed (PRD §6.2): the client's measured photo boxes (the black rounded rectangles of the
 * 2 tiras artwork, 2026-11-15). The owner fixed them: only the background art changes between events.
 *
 * Visible rectangles on the 1844×1240 sheet:
 * - top row, portrait, photos 1, 2, 3: left 121 / 533 / 944, top 44, 356 wide × 532 tall;
 * - bottom row, landscape, photos 1, 2: left 63 / 709, top 733, 600 wide × 402 tall.
 *
 * Left/Top/Width/Height are the box before rotation (DESIGN §6, editor model). The top slots turn by
 * 270°, so their unrotated box is 532 × 356 around the same center: Left = 121 + 178 − 266 = 33,
 * Top = 44 + 266 − 178 = 132 (and 445, 856 for the next two). The bottom slots have Angle 0, so their
 * numbers are the visible rectangle itself. The cut line y = 620 falls in the 576–733 gap. The
 * photos are clipped to the boxes' rounded corners (`radius`, see `CLIENT_BOX_RADIUS`).
 */
export const TWO_STRIPS_SEED: readonly Slot[] = [
  { id: 'top-1', photo: 1, left: 33, top: 132, width: 532, height: 356, angle: 270, radius: CLIENT_BOX_RADIUS },
  { id: 'top-2', photo: 2, left: 445, top: 132, width: 532, height: 356, angle: 270, radius: CLIENT_BOX_RADIUS },
  { id: 'top-3', photo: 3, left: 856, top: 132, width: 532, height: 356, angle: 270, radius: CLIENT_BOX_RADIUS },
  { id: 'bottom-1', photo: 1, left: 63, top: 733, width: 600, height: 402, angle: 0, radius: CLIENT_BOX_RADIUS },
  { id: 'bottom-2', photo: 2, left: 709, top: 733, width: 600, height: 402, angle: 0, radius: CLIENT_BOX_RADIUS },
]



/**
 * The visible photo boxes of the client's 2 tiras artwork, as measured on the sheet. The seed must
 * land exactly on them; a unit test checks it, and the montage test renders over that artwork.
 */
export const TWO_STRIPS_CLIENT_BOXES = [
  { left: 121, top: 44, width: 356, height: 532 },
  { left: 533, top: 44, width: 356, height: 532 },
  { left: 944, top: 44, width: 356, height: 532 },
  { left: 63, top: 733, width: 600, height: 402 },
  { left: 709, top: 733, width: 600, height: 402 },
] as const

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
