import { describe, expect, it } from 'vitest'
import { DEFAULT_FRAMING } from './geometry'
import { panFraming, rotateFraming, turnFraming, wheelZoomFactor, zoomFraming } from './framing'
import { TWO_STRIPS_SEED } from './seed'

const bottom1 = TWO_STRIPS_SEED[3]!
const top1 = TWO_STRIPS_SEED[0]!

describe('panFraming (RF09)', () => {
  it('moves the photo with the pointer: dragging down shows more of the top of the portrait', () => {
    const next = panFraming(DEFAULT_FRAMING, bottom1, { x: 0, y: 100 })
    expect(next.panY).toBeLessThan(0)
    // A horizontal slot at zoom 1 has no spare width: a sideways drag does nothing.
    expect(panFraming(DEFAULT_FRAMING, bottom1, { x: 100, y: 0 }).panX).toBe(0)
  })

  it('reads the drag in the photo axes of a slot at Angle 270', () => {
    // At zoom 2 there is spare on both axes; at Angle 270 a drag to the right is the photo's "down".
    const zoomed = { ...DEFAULT_FRAMING, zoom: 2 }
    const next = panFraming(zoomed, top1, { x: 50, y: 0 })
    expect(next.panY).toBeLessThan(0)
    expect(Math.abs(next.panX)).toBeLessThan(1e-9)
  })

  it('never pans past the edge of the photo', () => {
    expect(panFraming(DEFAULT_FRAMING, bottom1, { x: 0, y: 99_999 }).panY).toBe(-1)
    expect(panFraming(DEFAULT_FRAMING, bottom1, { x: 0, y: -99_999 }).panY).toBe(1)
  })
})

describe('zoomFraming and turnFraming (RF09)', () => {
  it('keeps the zoom in 1..3', () => {
    expect(zoomFraming(DEFAULT_FRAMING, 0.5).zoom).toBe(1)
    expect(zoomFraming({ ...DEFAULT_FRAMING, zoom: 2.5 }, 2).zoom).toBe(3)
    expect(wheelZoomFactor(-100)).toBeGreaterThan(1)
    expect(wheelZoomFactor(100)).toBeLessThan(1)
  })

  it('turns clockwise, folds past 180 and snaps to 0 within 3° unless Alt is held', () => {
    expect(turnFraming(DEFAULT_FRAMING, 10).rotation).toBe(10)
    expect(turnFraming({ ...DEFAULT_FRAMING, rotation: 175 }, 10).rotation).toBe(-175)
    expect(turnFraming({ ...DEFAULT_FRAMING, rotation: 5 }, -3).rotation).toBe(0)
    expect(turnFraming({ ...DEFAULT_FRAMING, rotation: 5 }, -3, { alt: true }).rotation).toBe(2)
  })

  it('turns by the angle the handle swept around the slot center', () => {
    const center = { x: bottom1.left + bottom1.width / 2, y: bottom1.top + bottom1.height / 2 }
    const start = { x: center.x, y: center.y + 100 }
    // From straight below to straight left of the center: a quarter turn clockwise.
    const next = rotateFraming(DEFAULT_FRAMING, bottom1, start, { x: center.x - 100, y: center.y })
    expect(next.rotation).toBe(90)
  })
})
