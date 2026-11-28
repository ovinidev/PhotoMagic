import type { Layouts, Slot } from './types'

/**
 * Corner radius of the client's black boxes, measured from the anti-aliased coverage of all 20
 * corners: 31.1 to 35.3 px (about 33). The seed clips 1 px under the smallest, so the photo's
 * anti-aliased rounded edge always lies past the black one: no black shows (a render test over the
 * artwork counts zero dark pixels in every box), and the photo sticks out by at most about 2 px of
 * white at the roundest corner, which the eye does not see.
 */
export const CLIENT_BOX_RADIUS = 30

/** Bleed of the seed past each side edge of the client's boxes, in sheet pixels (see below). */
export const CLIENT_BOX_BLEED = 1

/**
 * Two-strip seed (PRD §6.2): the client's measured photo boxes (the black rounded rectangles of the
 * 2 tiras artwork, 2026-11-15). The owner fixed them: only the background art changes between events.
 *
 * Visible rectangles on the 1844×1240 sheet:
 * - top row, portrait, photos 1, 2, 3: left 121 / 533 / 944, top 44, 356 wide × 532 tall;
 * - bottom row, landscape, photos 1, 2: left 63 / 709, top 733, 600 wide × 402 tall.
 *
 * Left/Top/Width/Height are the box before rotation (DESIGN §6, editor model). The boxes' right edge
 * is anti-aliased (a 35% black column just past the measured width, so they are about 356.35 px
 * wide), so the seed bleeds 1 px left and right (`CLIENT_BOX_BLEED`): no gray hairline shows, the
 * centers do not move and the numbers stay integers. The top slots turn by 270°, so their unrotated
 * box is 532 × 358 around the same center: Left = 121 + 178 − 266 = 33, Top = 44 + 266 − 179 = 131
 * (and 445, 856 for the next two). The bottom slots turn by 270° as well, so all five cards stand
 * upright like the top ones (client, 2026-11-28): the card is 602 × 402 unrotated around the box's
 * center, so it shows 402 wide and 602 tall over the lying box. The photo still fills the box (it is
 * planned on the fixed box, DESIGN §6) and the person stays upright, so the print does not change.
 * The cut line y = 620 falls in the 576–733 gap. The
 * photos are clipped to the boxes' rounded corners (`radius`, see `CLIENT_BOX_RADIUS`).
 */
export const TWO_STRIPS_SEED: readonly Slot[] = [
  { id: 'top-1', photo: 1, left: 33, top: 131, width: 532, height: 358, angle: 270, radius: CLIENT_BOX_RADIUS },
  { id: 'top-2', photo: 2, left: 445, top: 131, width: 532, height: 358, angle: 270, radius: CLIENT_BOX_RADIUS },
  { id: 'top-3', photo: 3, left: 856, top: 131, width: 532, height: 358, angle: 270, radius: CLIENT_BOX_RADIUS },
  { id: 'bottom-1', photo: 1, left: 62, top: 733, width: 602, height: 402, angle: 270, radius: CLIENT_BOX_RADIUS },
  { id: 'bottom-2', photo: 2, left: 708, top: 733, width: 602, height: 402, angle: 270, radius: CLIENT_BOX_RADIUS },
]

/**
 * A saved 2 tiras layout whose bottom cards still sit exactly on the old seed (Angle 0, never edited
 * by hand) gets the new Angle 270; any other value is the operator's own and stays.
 */
export function migrateTwoStrips(slots: readonly Slot[]): Slot[] {
  return slots.map((slot) => {
    const seed = TWO_STRIPS_SEED.find((current) => current.id === slot.id)
    const untouched =
      seed && seed.id.startsWith('bottom-') && slot.angle === 0 && slot.left === seed.left && slot.top === seed.top && slot.width === seed.width && slot.height === seed.height
    return untouched ? { ...slot, angle: seed.angle } : slot
  })
}



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
 * 40 px top/bottom margins, 40 px gaps, with the same rounded corners as the client's 2 tiras boxes
 * (the artwork usually has no boxes, so these are the standard boxes). Pending validation: not
 * measured on any artwork.
 */
export const ONE_STRIP_SEED: readonly Slot[] = [
  { id: 'photo-1', photo: 1, left: 42, top: 40, width: 560, height: 1160, angle: 0, radius: CLIENT_BOX_RADIUS },
  { id: 'photo-2', photo: 2, left: 642, top: 40, width: 560, height: 1160, angle: 0, radius: CLIENT_BOX_RADIUS },
  { id: 'photo-3', photo: 3, left: 1242, top: 40, width: 560, height: 1160, angle: 0, radius: CLIENT_BOX_RADIUS },
]

export const SEED_LAYOUTS: Layouts = {
  'two-strips': TWO_STRIPS_SEED,
  'one-strip': ONE_STRIP_SEED,
}

/**
 * The standard gray boxes of each mode, as unrotated rectangles (DESIGN §6): where the photos print
 * by default. They are not the cards: the 2 tiras bottom cards stand upright (Angle 270) over boxes
 * that lie down (602 × 402), so the boxes keep their own list.
 */
export const SEED_BOXES: Record<keyof Layouts, readonly { id: string; left: number; top: number; width: number; height: number; radius: number }[]> = {
  'two-strips': [
    { id: 'top-1', left: 120, top: 44, width: 358, height: 532, radius: CLIENT_BOX_RADIUS },
    { id: 'top-2', left: 532, top: 44, width: 358, height: 532, radius: CLIENT_BOX_RADIUS },
    { id: 'top-3', left: 943, top: 44, width: 358, height: 532, radius: CLIENT_BOX_RADIUS },
    { id: 'bottom-1', left: 62, top: 733, width: 602, height: 402, radius: CLIENT_BOX_RADIUS },
    { id: 'bottom-2', left: 708, top: 733, width: 602, height: 402, radius: CLIENT_BOX_RADIUS },
  ],
  'one-strip': ONE_STRIP_SEED.map(({ id, left, top, width, height }) => ({ id, left, top, width, height, radius: CLIENT_BOX_RADIUS })),
}

