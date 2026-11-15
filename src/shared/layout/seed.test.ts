import { describe, expect, it } from 'vitest'
import { SHEET } from '../constants'
import { slotBounds, type Rect } from './geometry'
import { ONE_STRIP_SEED, SEED_LAYOUTS, TWO_STRIPS_CLIENT_BOXES, TWO_STRIPS_SEED } from './seed'
import { CUT_LINE_Y } from './types'
import { PRINT_MODES, cutFor } from './types'

const intersects = (a: Rect, b: Rect) =>
  a.left < b.left + b.width && b.left < a.left + a.width && a.top < b.top + b.height && b.top < a.top + a.height

describe('two-strip seed (RF03)', () => {
  it('has the five slots of the PRD table', () => {
    expect(TWO_STRIPS_SEED.map(({ id, photo, left, top, width, height, angle }) => [id, photo, left, top, width, height, angle])).toEqual([
      ['top-1', 1, 33, 132, 532, 356, 270],
      ['top-2', 2, 445, 132, 532, 356, 270],
      ['top-3', 3, 856, 132, 532, 356, 270],
      ['bottom-1', 1, 63, 733, 600, 402, 0],
      ['bottom-2', 2, 709, 733, 600, 402, 0],
    ])
  })

  it('lands exactly on the client artwork photo boxes, inside the sheet', () => {
    expect(TWO_STRIPS_SEED.map(slotBounds)).toEqual(TWO_STRIPS_CLIENT_BOXES)
    for (const box of TWO_STRIPS_SEED.map(slotBounds)) {
      expect(box.left).toBeGreaterThanOrEqual(0)
      expect(box.top).toBeGreaterThanOrEqual(0)
      expect(box.left + box.width).toBeLessThanOrEqual(SHEET.width)
      expect(box.top + box.height).toBeLessThanOrEqual(SHEET.height)
    }
  })

  it('keeps the working cut line y = 620 in the gap between the two strips', () => {
    const [top, , , bottom] = TWO_STRIPS_SEED.map(slotBounds) as [Rect, Rect, Rect, Rect]
    expect(top.top + top.height).toBe(576)
    expect(bottom.top).toBe(733)
    expect(CUT_LINE_Y).toBeGreaterThan(576)
    expect(CUT_LINE_Y).toBeLessThan(733)
  })

  it('keeps Cima 3 at Angle 270, not the demo leftover', () => {
    expect(TWO_STRIPS_SEED.find((slot) => slot.id === 'top-3')?.angle).toBe(270)
  })

  it('does not overlap Baixo 1 and Baixo 2, nor any two slots', () => {
    const bounds = TWO_STRIPS_SEED.map(slotBounds)
    for (const [i, a] of bounds.entries()) {
      for (const b of bounds.slice(i + 1)) expect(intersects(a, b)).toBe(false)
    }
  })

  it('draws the top slots tall and the bottom slots lying down', () => {
    for (const slot of TWO_STRIPS_SEED.slice(0, 3)) expect(slotBounds(slot)).toMatchObject({ width: 356, height: 532 })
    for (const slot of TWO_STRIPS_SEED.slice(3)) expect(slotBounds(slot)).toMatchObject({ width: 600, height: 402 })
  })

  it('defaults to photos 1, 2, 3, 1, 2', () => {
    expect(TWO_STRIPS_SEED.map((slot) => slot.photo)).toEqual([1, 2, 3, 1, 2])
  })
})

describe('one-strip seed (RF03)', () => {
  it('has three portrait slots, photos 1, 2 and 3 at Angle 0, at the PRD numbers', () => {
    expect(ONE_STRIP_SEED.map(({ photo, left, top, width, height, angle }) => [photo, left, top, width, height, angle])).toEqual([
      [1, 42, 40, 560, 1160, 0],
      [2, 642, 40, 560, 1160, 0],
      [3, 1242, 40, 560, 1160, 0],
    ])
  })

  it('covers the sheet with 40 px gaps and margins, with no blank half', () => {
    const [first, second, third] = ONE_STRIP_SEED.map(slotBounds) as [Rect, Rect, Rect]
    expect(second.left - (first.left + first.width)).toBe(40)
    expect(third.left - (second.left + second.width)).toBe(40)
    expect(first.left).toBe(42)
    expect(SHEET.width - (third.left + third.width)).toBe(42)
    for (const slot of [first, second, third]) {
      expect(slot.top).toBe(40)
      expect(SHEET.height - (slot.top + slot.height)).toBe(40)
    }
  })
})

describe('modes', () => {
  it('turns the cut on in 2 tiras and off in 1 tira', () => {
    expect(cutFor('two-strips')).toBe(true)
    expect(cutFor('one-strip')).toBe(false)
  })

  it('has one seed per mode', () => {
    expect(Object.keys(SEED_LAYOUTS).sort()).toEqual([...PRINT_MODES].sort())
  })
})
