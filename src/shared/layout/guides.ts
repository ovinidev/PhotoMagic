import { slotBounds, type Rect } from './geometry'
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
 * The fixed box a slot belongs to (DESIGN §6, fixed masks): the gray guide box with the slot's id
 * (Cima 1/2/3, Baixo 1/2, Foto 1/2/3), or, for an unknown id, the box at the slot's index. Together
 * with `seedSlot`, the seed slot that box comes from. `null` when the slot has no box: it shows
 * nothing. The montage, the laptop framing preview and the TV preview clip every photo to this box,
 * whatever the slot's own position and size: nothing is ever drawn outside a gray box.
 */
export function fixedBox(mode: PrintMode, slotId: string, index: number): { box: GuideBox; seedSlot: Slot } | null {
  const seed = SEED_LAYOUTS[mode]
  const seedSlot = seed.find((slot) => slot.id === slotId) ?? seed[index]
  if (!seedSlot) return null
  return { box: { id: seedSlot.id, rect: slotBounds(seedSlot), radius: seedSlot.radius ?? 0 }, seedSlot }
}

/** True when the slot sits exactly on its seed slot (same place, size and angle): the default card. */
export function onSeed(slot: Slot, seedSlot: Slot): boolean {
  return (
    slot.left === seedSlot.left &&
    slot.top === seedSlot.top &&
    slot.width === seedSlot.width &&
    slot.height === seedSlot.height &&
    slot.angle === seedSlot.angle &&
    (slot.radius ?? 0) === (seedSlot.radius ?? 0)
  )
}
