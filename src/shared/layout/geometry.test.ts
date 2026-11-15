import { describe, expect, it } from 'vitest'
import type { Slot } from './types'
import {
  clampFraming,
  clipToSheet,
  guideCrop,
  nearestQuarterTurn,
  normalizeAngle,
  planSlot,
  slotBounds,
  slotCrop,
} from './geometry'
import { ONE_STRIP_SEED, TWO_STRIPS_SEED } from './seed'

const PORTRAIT = { width: 2160, height: 3840 }
const slot = (overrides: Partial<Slot>): Slot => ({ id: 's', photo: 1, left: 100, top: 100, width: 500, height: 281, angle: 0, ...overrides })

describe('angles', () => {
  it('folds angles into [0, 360)', () => {
    expect(normalizeAngle(-90)).toBe(270)
    expect(normalizeAngle(450)).toBe(90)
    expect(normalizeAngle(360)).toBe(0)
  })

  it('finds the closest quarter turn', () => {
    expect(nearestQuarterTurn(0)).toBe(0)
    expect(nearestQuarterTurn(265)).toBe(270)
    expect(nearestQuarterTurn(-10)).toBe(0)
    expect(nearestQuarterTurn(359)).toBe(0)
    expect(nearestQuarterTurn(134)).toBe(90)
  })
})

describe('slotBounds', () => {
  it('rotates around the center without swapping width and height in the model', () => {
    // Cima 1: center (322, 210.5); 270 makes it 281 wide and 500 tall, sticking out above the sheet.
    expect(slotBounds(TWO_STRIPS_SEED[0]!)).toEqual({ left: 181.5, top: -39.5, width: 281, height: 500 })
  })

  it('grows to the bounding box of a tilted slot', () => {
    const bounds = slotBounds(slot({ left: 0, top: 0, width: 100, height: 100, angle: 45 }))
    expect(bounds.width).toBeCloseTo(141.42, 2)
    expect(bounds.left).toBeCloseTo(50 - 70.71, 2)
  })
})

describe('planSlot', () => {
  it('crops the center of a portrait in equal parts above and below for a horizontal slot (RF08)', () => {
    const plan = planSlot(slot({ angle: 0 }), PORTRAIT)
    expect(plan.preRotate).toBe(0)
    expect(plan.resize).toEqual({ width: 500, height: 889 })
    expect(plan.extract).toEqual({ left: 0, top: 304, width: 500, height: 281 })
    // 304 above, 889 − 304 − 281 = 304 below.
    expect(plan.resize.height - plan.extract.top - plan.extract.height).toBe(plan.extract.top)
  })

  it('pre-rotates the photo for Angle 270 so the slot stands it up again', () => {
    const plan = planSlot(slot({ angle: 270 }), PORTRAIT)
    // 270 + 90 = 360: the tile is the photo turned 90° clockwise, then turned 270° back.
    expect(plan.preRotate).toBe(90)
    expect(plan.angle).toBe(270)
    // The turned photo is 3840×2160 (16:9), so it covers 500×281 almost exactly.
    expect(plan.resize).toEqual({ width: 500, height: 281 })
    expect(plan.extract).toEqual({ left: 0, top: 0, width: 500, height: 281 })
  })

  it('pre-rotates by the nearest quarter turn for a tilted slot', () => {
    expect(planSlot(slot({ angle: 92 }), PORTRAIT).preRotate).toBe(270)
    expect(planSlot(slot({ angle: 180 }), PORTRAIT).preRotate).toBe(180)
  })

  it('fits a portrait slot of the one-strip seed', () => {
    const plan = planSlot(ONE_STRIP_SEED[0]!, PORTRAIT)
    expect(plan.resize).toEqual({ width: 653, height: 1160 })
    expect(plan.extract).toEqual({ left: 47, top: 0, width: 560, height: 1160 })
    expect(plan.center).toEqual({ x: 322, y: 620 })
  })

  it('zooms and pans without uncovering the slot (RF09)', () => {
    const zoomed = planSlot(slot({}), PORTRAIT, { zoom: 2, panX: -1, panY: 1 })
    expect(zoomed.resize).toEqual({ width: 1000, height: 1778 })
    expect(zoomed.extract).toEqual({ left: 0, top: 1778 - 281, width: 500, height: 281 })

    const past = planSlot(slot({}), PORTRAIT, { zoom: 9, panX: 5, panY: -5 })
    expect(past.resize.width).toBe(1500)
    expect(past.extract.left + past.extract.width).toBe(past.resize.width)
    expect(past.extract.top).toBe(0)
  })

  it('never resizes below the slot box', () => {
    const plan = planSlot(slot({ width: 501, height: 281 }), { width: 1001, height: 563 })
    expect(plan.resize.width).toBeGreaterThanOrEqual(501)
    expect(plan.resize.height).toBeGreaterThanOrEqual(281)
  })
})

describe('clampFraming', () => {
  it('keeps zoom in 1..3 and pan in -1..1, and repairs non-numbers', () => {
    expect(clampFraming({ zoom: 0.5, panX: -2, panY: 2 })).toEqual({ zoom: 1, panX: -1, panY: 1 })
    expect(clampFraming({ zoom: 4, panX: 0.25, panY: Number.NaN })).toEqual({ zoom: 3, panX: 0.25, panY: 0 })
  })
})

describe('clipToSheet', () => {
  it('keeps a tile that fits as it is', () => {
    expect(clipToSheet({ x: 322, y: 620 }, { width: 560, height: 1160 })).toEqual({
      source: { left: 0, top: 0, width: 560, height: 1160 },
      target: { left: 42, top: 40 },
    })
  })

  it('cuts the part above the sheet (Cima 1 of the seed)', () => {
    expect(clipToSheet({ x: 322, y: 210.5 }, { width: 281, height: 500 })).toEqual({
      // 181.5 rounds to 182 and -39.5 to -39 (Math.round goes up on .5).
      source: { left: 0, top: 39, width: 281, height: 461 },
      target: { left: 182, top: 0 },
    })
  })

  it('cuts the right and bottom edges, and drops a tile off the sheet', () => {
    expect(clipToSheet({ x: 1844, y: 1240 }, { width: 100, height: 100 })).toEqual({
      source: { left: 0, top: 0, width: 50, height: 50 },
      target: { left: 1794, top: 1190 },
    })
    expect(clipToSheet({ x: -100, y: 10 }, { width: 100, height: 100 })).toBeNull()
  })
})

describe('slotCrop and guideCrop', () => {
  const FRAME = { width: 9, height: 16 }

  it('keeps the whole height for a slot taller than the frame aspect', () => {
    const crop = slotCrop(ONE_STRIP_SEED[0]!, FRAME)
    expect(crop.height).toBe(1)
    expect(crop.width).toBeCloseTo((560 / 1160) * (16 / 9), 6)
    expect(crop.left).toBeCloseTo((1 - crop.width) / 2, 6)
  })

  it('shows the bottom strip band for photo 1 in 2 tiras', () => {
    const guide = guideCrop(TWO_STRIPS_SEED, 1, FRAME)
    // Cima 1 (281:500) is a hair narrower than 9:16; the band is the bottom slot's height.
    expect(guide?.width).toBeCloseTo(1, 2)
    expect(guide?.height).toBeCloseTo((281 / 500) * (9 / 16), 6)
    expect(guide!.top).toBeCloseTo((1 - guide!.height) / 2, 6)
  })

  it('follows the only, vertical slot of photo 3 in 2 tiras', () => {
    const guide = guideCrop(TWO_STRIPS_SEED, 3, FRAME)
    expect(guide).toEqual(slotCrop(TWO_STRIPS_SEED[2]!, FRAME))
    expect(guide!.height).toBe(1)
  })

  it('is null when no slot uses the photo', () => {
    expect(guideCrop(TWO_STRIPS_SEED.slice(3), 3, FRAME)).toBeNull()
  })
})
