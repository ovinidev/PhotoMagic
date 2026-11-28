import { describe, expect, it } from 'vitest'
import { SHEET } from '../constants'
import { slotBounds } from './geometry'
import { boxToSlot, defaultFixedBoxes, fixedBox, guideBoxes, slotToBox } from './guides'
import { CLIENT_BOX_BLEED, CLIENT_BOX_RADIUS, TWO_STRIPS_CLIENT_BOXES } from './seed'

describe('guideBoxes', () => {
  it('draws the client 2 tiras boxes: 3 portrait on top, 2 landscape below, rounded', () => {
    const boxes = guideBoxes('two-strips')
    expect(boxes).toHaveLength(5)
    boxes.forEach((box, index) => {
      const client = TWO_STRIPS_CLIENT_BOXES[index]!
      // The seed bleeds 1 px past the anti-aliased side edges; top and height are exact.
      expect(box.rect.left).toBeCloseTo(client.left - CLIENT_BOX_BLEED, 6)
      expect(box.rect.width).toBeCloseTo(client.width + 2 * CLIENT_BOX_BLEED, 6)
      expect(box.rect.top).toBeCloseTo(client.top, 6)
      expect(box.rect.height).toBeCloseTo(client.height, 6)
      expect(box.radius).toBe(CLIENT_BOX_RADIUS)
    })
    expect(boxes.slice(0, 3).every((box) => box.rect.height > box.rect.width)).toBe(true)
    expect(boxes.slice(3).every((box) => box.rect.width > box.rect.height)).toBe(true)
  })

  it('draws the 3 portrait boxes of 1 tira inside the sheet, rounded', () => {
    const boxes = guideBoxes('one-strip')
    expect(boxes.map((box) => box.rect)).toEqual([
      { left: 42, top: 40, width: 560, height: 1160 },
      { left: 642, top: 40, width: 560, height: 1160 },
      { left: 1242, top: 40, width: 560, height: 1160 },
    ])
    for (const box of boxes) {
      expect(box.radius).toBe(CLIENT_BOX_RADIUS)
      expect(box.rect.left + box.rect.width).toBeLessThanOrEqual(SHEET.width)
      expect(box.rect.top + box.rect.height).toBeLessThanOrEqual(SHEET.height)
    }
  })
})

describe('fixedBox', () => {
  it('assigns each slot the gray box with its id, whatever the slot moved to', () => {
    const moved = { id: 'bottom-2', photo: 2 as const, left: 1000, top: 100, width: 900, height: 700, angle: 10 }
    const fixed = fixedBox('two-strips', moved.id, 0)!
    expect(fixed.box).toEqual(guideBoxes('two-strips')[4])
    expect(fixed.seedSlot.id).toBe('bottom-2')
  })

  it('falls back to the box at the slot index for an unknown id, and to none past the boxes', () => {
    expect(fixedBox('one-strip', 'other', 1)?.box.id).toBe('photo-2')
    expect(fixedBox('one-strip', 'other', 3)).toBeNull()
  })
})

describe('fixedBox with the template boxes', () => {
  const detected = [
    { id: 'top-1', rect: { left: 90, top: 80, width: 380, height: 500 }, radius: 58 },
    { id: 'top-2', rect: { left: 520, top: 80, width: 380, height: 500 }, radius: 58 },
    { id: 'top-3', rect: { left: 950, top: 80, width: 380, height: 500 }, radius: 58 },
    { id: 'bottom-1', rect: { left: 90, top: 690, width: 620, height: 470 }, radius: 58 },
    { id: 'bottom-2', rect: { left: 760, top: 690, width: 570, height: 470 }, radius: 58 },
  ]

  it('uses the detected box of the slot and a seed slot sitting exactly on it', () => {
    const fixed = fixedBox('two-strips', 'top-2', 1, detected)!
    expect(fixed.box).toEqual(detected[1])
    // A quarter-turned slot: its unrotated size is the box's, swapped, around the box center.
    expect(fixed.seedSlot).toMatchObject({ id: 'top-2', angle: 270, width: 500, height: 380, left: 460, top: 140, radius: 58 })
    expect(slotBounds(fixed.seedSlot)).toEqual(detected[1]!.rect)
    const bottom = fixedBox('two-strips', 'bottom-2', 4, detected)!
    expect(bottom.seedSlot).toMatchObject({ angle: 270, left: 810, top: 640, width: 470, height: 570 })
  })

  it('falls back to the seed boxes when the count does not match the mode', () => {
    expect(fixedBox('two-strips', 'top-1', 0, detected.slice(0, 4))!.box).toEqual(fixedBox('two-strips', 'top-1', 0)!.box)
    expect(fixedBox('one-strip', 'photo-1', 0, detected)!.box).toEqual(fixedBox('one-strip', 'photo-1', 0)!.box)
    expect(fixedBox('two-strips', 'top-1', 0, null)!.box.rect.left).toBe(120)
  })
})

describe('defaultFixedBoxes and the editor box slots (DESIGN §6)', () => {
  it('uses the detected boxes when there is one per seed slot, renamed to the seed ids, else the seed boxes', () => {
    const detected = guideBoxes('two-strips').map((box, i) => ({ ...box, id: `found-${i}`, rect: { ...box.rect, left: box.rect.left + 5 } }))
    expect(defaultFixedBoxes('two-strips', detected).map((box) => [box.id, box.rect.left])).toEqual(guideBoxes('two-strips').map((box) => [box.id, box.rect.left + 5]))
    expect(defaultFixedBoxes('two-strips', detected.slice(0, 3))).toEqual(guideBoxes('two-strips'))
    expect(defaultFixedBoxes('one-strip', null)).toEqual(guideBoxes('one-strip'))
  })

  it('turns a box into an unrotated, photo-less slot and back', () => {
    const box = guideBoxes('two-strips')[3]!
    const slot = boxToSlot(box, 'box:bottom-1')
    expect(slot).toMatchObject({ id: 'box:bottom-1', photo: null, angle: 0, ...box.rect })
    expect(slotToBox(slot, 'bottom-1')).toEqual(box)
  })
})
