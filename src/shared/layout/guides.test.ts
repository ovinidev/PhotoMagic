import { describe, expect, it } from 'vitest'
import { SHEET } from '../constants'
import { guideBoxes } from './guides'
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
