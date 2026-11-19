import { describe, expect, it } from 'vitest'
import { SHEET } from '@shared/constants'
import { SEED_LAYOUTS, guideBoxes } from '@shared/layout'
import { REVEAL, revealBoxes, revealTotal } from './reveal'

describe('revealBoxes', () => {
  it('puts one reveal box on each fixed box of the 2-strip seed, in percent of the sheet', () => {
    const reveal = revealBoxes('two-strips', SEED_LAYOUTS['two-strips'])
    const boxes = guideBoxes('two-strips')
    expect(reveal.map((item) => item.id)).toEqual(boxes.map((box) => box.id))
    reveal.forEach((item, i) => {
      const box = boxes[i]!
      expect(item.left).toBeCloseTo((box.rect.left / SHEET.width) * 100)
      expect(item.top).toBeCloseTo((box.rect.top / SHEET.height) * 100)
      expect(item.width).toBeCloseTo((box.rect.width / SHEET.width) * 100)
      expect(item.height).toBeCloseTo((box.rect.height / SHEET.height) * 100)
    })
  })

  it('slides the boxes of the same photo in together, photo 1 first, and finishes under 1.2 s', () => {
    const one = revealBoxes('one-strip', SEED_LAYOUTS['one-strip'])
    expect(one.map((item) => [item.photo, item.delay])).toEqual([
      [1, 0],
      [2, REVEAL.stagger],
      [3, 2 * REVEAL.stagger],
    ])
    expect(revealTotal(one)).toBeLessThan(1200)
    const two = revealBoxes('two-strips', SEED_LAYOUTS['two-strips'])
    expect(revealTotal(two)).toBeLessThan(1200)
    for (const item of two) expect(item.delay).toBe((item.photo - 1) * REVEAL.stagger)
  })

  it('skips a slot with no photo and an empty layout reveals nothing', () => {
    const slots = SEED_LAYOUTS['one-strip'].map((slot, i) => (i === 1 ? { ...slot, photo: null } : slot))
    expect(revealBoxes('one-strip', slots).map((item) => item.photo)).toEqual([1, 3])
    expect(revealTotal([])).toBe(0)
  })
})
