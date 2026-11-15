import { describe, expect, it } from 'vitest'
import { slotBounds } from './geometry'
import { MIN_SLOT_SIZE, angleTowards, crossesCutLine, moveSlot, resizeSlot, roundSlot } from './gesture'
import type { Slot } from './types'

const flat: Slot = { id: 'bottom-1', photo: 1, left: 72, top: 670, width: 500, height: 281, angle: 0 }
const tall: Slot = { id: 'top-1', photo: 1, left: 72, top: 70, width: 500, height: 281, angle: 270 }

const close = (slot: Slot) => roundSlot(slot)

describe('moveSlot', () => {
  it('shifts Left and Top by the pointer delta', () => {
    expect(moveSlot(flat, { x: 30, y: -12 })).toMatchObject({ left: 102, top: 658, width: 500, height: 281 })
  })
})

describe('resizeSlot', () => {
  it('drags the east edge of an upright slot and keeps the west edge', () => {
    expect(close(resizeSlot(flat, 'e', { x: 40, y: 99 }))).toMatchObject({ left: 72, top: 670, width: 540, height: 281 })
  })

  it('drags the north-west corner and keeps the south-east corner', () => {
    expect(close(resizeSlot(flat, 'nw', { x: 20, y: 10 }))).toMatchObject({ left: 92, top: 680, width: 480, height: 271 })
  })

  it('reads the delta in the slot axes at Angle 270', () => {
    // At 270 the local east edge points up on the sheet: dragging it up grows Width, the bottom stays.
    const before = slotBounds(tall)
    const after = resizeSlot(tall, 'e', { x: 0, y: -50 })
    expect(Math.round(after.width)).toBe(550)
    expect(after.height).toBe(281)
    const bounds = slotBounds(after)
    expect(Math.round(bounds.top + bounds.height)).toBe(Math.round(before.top + before.height))
    expect(Math.round(bounds.top)).toBe(Math.round(before.top - 50))
  })

  it('never goes below the minimum size', () => {
    const tiny = resizeSlot(flat, 'se', { x: -1000, y: -1000 })
    expect(tiny.width).toBe(MIN_SLOT_SIZE)
    expect(tiny.height).toBe(MIN_SLOT_SIZE)
    expect(tiny.left).toBe(72)
    expect(tiny.top).toBe(670)
  })
})

describe('angleTowards', () => {
  it('is 0 with the pointer straight below the center, and turns clockwise', () => {
    const center = { x: 72 + 250, y: 670 + 140.5 }
    expect(angleTowards(flat, { x: center.x, y: center.y + 200 })).toBeCloseTo(0)
    expect(angleTowards(flat, { x: center.x - 200, y: center.y })).toBeCloseTo(90)
    expect(angleTowards(flat, { x: center.x, y: center.y - 200 })).toBeCloseTo(180)
    expect(angleTowards(flat, { x: center.x + 200, y: center.y })).toBeCloseTo(270)
  })
})

describe('roundSlot', () => {
  it('rounds to integers and folds 360 to 0', () => {
    expect(roundSlot({ ...flat, left: 10.4, top: 9.6, width: 39.2, height: 100.5, angle: 359.7 })).toMatchObject({
      left: 10,
      top: 10,
      width: 40,
      height: 101,
      angle: 0,
    })
  })
})

describe('crossesCutLine', () => {
  it('flags a slot whose visible box crosses y = 620, not one that only touches it', () => {
    expect(crossesCutLine(flat)).toBe(false)
    expect(crossesCutLine({ ...flat, top: 600 })).toBe(true)
    expect(crossesCutLine({ ...flat, top: 620 })).toBe(false)
    // Cima 1 of the seed reaches 70 + 140.5 + 250 = 460.5: clear of the line.
    expect(crossesCutLine(tall)).toBe(false)
  })
})
