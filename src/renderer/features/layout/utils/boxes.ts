import { boxToSlot, slotToBox, type GuideBox, type Slot } from '@shared/layout'

/**
 * The editor keeps the cards and the fixed gray boxes in one list, so one Undo history covers both:
 * a box is an unrotated, photo-less slot whose id is `box:<slot id>` (DESIGN §6, §7).
 */
const PREFIX = 'box:'

export const isBoxId = (id: string) => id.startsWith(PREFIX)
export const boxSlotId = (id: string) => (isBoxId(id) ? id.slice(PREFIX.length) : id)

/** Cards then boxes, the editor's working list. */
export const joinItems = (cards: readonly Slot[], boxes: readonly GuideBox[]): Slot[] => [...cards, ...boxes.map((box) => boxToSlot(box, PREFIX + box.id))]

export const cardsOf = (items: readonly Slot[]): Slot[] => items.filter((item) => !isBoxId(item.id))
export const boxItemsOf = (items: readonly Slot[]): Slot[] => items.filter((item) => isBoxId(item.id))
export const boxesOf = (items: readonly Slot[]): GuideBox[] => boxItemsOf(items).map((item) => slotToBox(item, boxSlotId(item.id)))
