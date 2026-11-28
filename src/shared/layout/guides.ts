import { clampFraming, nearestQuarterTurn, normalizeAngle, slotBounds, type Framing, type Rect } from './geometry'
import { SEED_LAYOUTS } from './seed'
import type { PrintMode, Slot } from './types'

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

/**
 * A template's fixed boxes before the operator moves any (DESIGN §6): the dark boxes found on it when
 * there is one per seed slot, otherwise the seed's gray boxes.
 */
export function defaultFixedBoxes(mode: PrintMode, detected?: readonly GuideBox[] | null): GuideBox[] {
  const seed = guideBoxes(mode)
  return detected && detected.length === seed.length ? detected.map((box, index) => ({ ...box, id: seed[index]!.id })) : [...seed]
}

/** A fixed box as an unrotated, photo-less slot, so the editor moves and resizes it like a card. */
export function boxToSlot(box: GuideBox, id = box.id): Slot {
  return { id, photo: null, ...box.rect, angle: 0, radius: box.radius }
}

/** The editor's slot back to a fixed box (angle ignored: fixed boxes never turn). */
export function slotToBox(slot: Slot, id = slot.id): GuideBox {
  return { id, rect: { left: slot.left, top: slot.top, width: slot.width, height: slot.height }, radius: slot.radius ?? 0 }
}

/**
 * The fixed box a slot belongs to (DESIGN §6, fixed masks): the gray guide box with the slot's id
 * (Cima 1/2/3, Baixo 1/2, Foto 1/2/3), or, for an unknown id, the box at the slot's index. Together
 * with `seedSlot`, the slot that sits exactly on that box. `null` when the slot has no box: it shows
 * nothing. The montage, the laptop framing preview and the TV preview clip every photo to this box,
 * whatever the slot's own position and size: nothing is ever drawn outside a gray box.
 *
 * `boxes` are the dark boxes found on the event's template (main, `detectTemplateBoxes`), in seed
 * order. When there is one per seed slot they replace the seed boxes; otherwise the seed is used.
 */
export function fixedBox(mode: PrintMode, slotId: string, index: number, boxes?: readonly GuideBox[] | null): { box: GuideBox; seedSlot: Slot } | null {
  const seed = SEED_LAYOUTS[mode]
  const found = seed.findIndex((slot) => slot.id === slotId)
  const at = found === -1 ? index : found
  const seedSlot = seed[at]
  if (!seedSlot) return null
  const detected = boxes && boxes.length === seed.length ? boxes[at] : undefined
  if (detected) return { box: { ...detected, id: seedSlot.id }, seedSlot: slotOnBox(seedSlot, detected) }
  return { box: { id: seedSlot.id, rect: slotBounds(seedSlot), radius: seedSlot.radius ?? 0 }, seedSlot }
}

/**
 * The seed slot moved and resized onto `box`, keeping its angle: centered on the box, with the box's
 * size (width and height swapped for a quarter turn) and corner radius.
 */
export function slotOnBox(seedSlot: Slot, box: GuideBox): Slot {
  const quarter = Math.abs(seedSlot.angle % 180) === 90
  const width = quarter ? box.rect.height : box.rect.width
  const height = quarter ? box.rect.width : box.rect.height
  const cx = box.rect.left + box.rect.width / 2
  const cy = box.rect.top + box.rect.height / 2
  return { ...seedSlot, left: cx - width / 2, top: cy - height / 2, width, height, radius: box.radius }
}

/**
 * Where one slot's photo is drawn (DESIGN §6): exactly one photo per fixed box. The photo is planned
 * on the box itself (`slot`: the seed slot moved onto the box, `slotOnBox`), never on the card, so it
 * always covers the whole box and its zoom does not depend on how large the card was drawn. The card
 * only decides how the photo is turned: its nearest quarter turn orients the photo, and whatever is
 * left of its angle is added to the framing rotation (`planSlot` grows the photo to keep the box
 * covered). `null` when the slot has no box. The montage and the laptop framing preview both use it.
 */
export function photoInBox(
  mode: PrintMode,
  card: Slot,
  index: number,
  framing: Framing,
  boxes?: readonly GuideBox[] | null,
): { box: GuideBox; slot: Slot; framing: Framing } | null {
  const fixed = fixedBox(mode, card.id, index, boxes)
  if (!fixed) return null
  const quarter = nearestQuarterTurn(card.angle)
  const slot = slotOnBox({ ...fixed.seedSlot, id: card.id, photo: card.photo, angle: quarter }, fixed.box)
  const rest = normalizeAngle(card.angle - quarter)
  const residual = rest > 180 ? rest - 360 : rest
  return { box: fixed.box, slot, framing: residual === 0 ? framing : clampFraming({ ...framing, rotation: framing.rotation + residual }) }
}
