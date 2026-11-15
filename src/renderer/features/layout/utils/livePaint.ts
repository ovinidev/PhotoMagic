import type { CSSProperties } from 'react'
import { SHEET } from '@shared/constants'
import type { Slot } from '@shared/layout'

/**
 * The fluid path of the editor (DESIGN §7): during a gesture nothing goes through React state, IPC or
 * disk. Each pointer move writes the card's position and the panel's numbers straight to the DOM, in
 * the same frame. React state (and `layout:save`) only change on release.
 */

export const NUMBER_FIELDS = ['left', 'top', 'width', 'height', 'angle'] as const
export type NumberField = (typeof NUMBER_FIELDS)[number]

export type LiveRegistry = {
  cards: Map<string, HTMLElement>
  fields: Map<string, HTMLInputElement>
}

export const createRegistry = (): LiveRegistry => ({ cards: new Map(), fields: new Map() })
export const fieldKey = (slotId: string, field: NumberField) => `${slotId}:${field}`

const percent = (value: number, of: number) => `${(value / of) * 100}%`

/** Where the card sits on the sheet, in percent of the sheet, rotated around its center. */
export function slotStyle(slot: Slot): Pick<CSSProperties, 'left' | 'top' | 'width' | 'height' | 'transform'> {
  return {
    left: percent(slot.left, SHEET.width),
    top: percent(slot.top, SHEET.height),
    width: percent(slot.width, SHEET.width),
    height: percent(slot.height, SHEET.height),
    transform: `rotate(${slot.angle}deg)`,
  }
}

/** Writes the slot to its card and to its panel row. Skips the field being typed in. */
export function paintSlot(registry: LiveRegistry, slot: Slot): void {
  const card = registry.cards.get(slot.id)
  if (card) Object.assign(card.style, slotStyle(slot))
  for (const field of NUMBER_FIELDS) {
    const input = registry.fields.get(fieldKey(slot.id, field))
    if (input && input !== document.activeElement) input.value = String(slot[field])
  }
}
