import { SHEET } from '@shared/constants'
import { fixedBox, type GuideBox, type PrintMode, type Slot } from '@shared/layout'

/**
 * Timing of the montage reveal on the TV print screen (DESIGN §14, Motion). Each photo slides into
 * its box `stagger` after the previous one; the last one is in place by `revealTotal`, under 1.2 s.
 */
export const REVEAL = { duration: 560, stagger: 220 } as const

/** A fixed box on the sheet, in percent of the sheet, so the reveal scales with the preview. */
export type RevealBox = {
  id: string
  photo: number
  left: number
  top: number
  width: number
  height: number
  /** Corner radius, in percent of the box width and height. */
  radiusX: number
  radiusY: number
  /** When this box's photo starts sliding in, in ms from the start of the reveal. */
  delay: number
}

/**
 * One reveal box per slot that holds a photo, on the slot's fixed box (DESIGN §6), which is exactly
 * where the montage draws that photo. Boxes with the same photo slide in together; photo 1 first.
 * The reveal shows the montage itself cropped to the box, so it never draws a second version of a photo.
 */
export function revealBoxes(mode: PrintMode, slots: readonly Slot[], boxes?: readonly GuideBox[] | null): RevealBox[] {
  const photos = [...new Set(slots.flatMap((slot) => (slot.photo === null ? [] : [slot.photo])))].sort((a, b) => a - b)
  return slots.flatMap((slot, index) => {
    if (slot.photo === null) return []
    const fixed = fixedBox(mode, slot.id, index, boxes)
    if (!fixed) return []
    const { rect, radius } = fixed.box
    return [
      {
        id: slot.id,
        photo: slot.photo,
        left: (rect.left / SHEET.width) * 100,
        top: (rect.top / SHEET.height) * 100,
        width: (rect.width / SHEET.width) * 100,
        height: (rect.height / SHEET.height) * 100,
        radiusX: (radius / rect.width) * 100,
        radiusY: (radius / rect.height) * 100,
        delay: photos.indexOf(slot.photo) * REVEAL.stagger,
      },
    ]
  })
}

/** When the last photo is in place, in ms: the reveal overlay can go. */
export function revealTotal(boxes: readonly RevealBox[]): number {
  return boxes.length === 0 ? 0 : Math.max(...boxes.map((box) => box.delay)) + REVEAL.duration
}
