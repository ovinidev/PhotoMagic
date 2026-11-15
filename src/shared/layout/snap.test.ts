import { describe, expect, it } from 'vitest'
import { slotBounds } from './geometry'
import { resizeSlot } from './gesture'
import { snapAngle, snapMove, snapResize } from './snap'
import type { Slot } from './types'

// A 500×281 upright slot far from every target, used as the moving one.
const free: Slot = { id: 'a', photo: 1, left: 300, top: 300, width: 500, height: 281, angle: 0 }
const two = { mode: 'two-strips' as const, alt: false }
const one = { mode: 'one-strip' as const, alt: false }

describe('snapMove (RF03)', () => {
  it('snaps to a sheet edge at 6 px, not at 9 px, and not with Alt held', () => {
    expect(snapMove({ ...free, left: 6 }, [], two).left).toBe(0)
    expect(snapMove({ ...free, left: 9 }, [], two).left).toBe(9)
    expect(snapMove({ ...free, left: 6 }, [], { ...two, alt: true }).left).toBe(6)
    // Right edge to x = 1844.
    expect(snapMove({ ...free, left: 1844 - 500 - 6 }, [], two).left).toBe(1344)
  })

  it('snaps to the print margins', () => {
    expect(snapMove({ ...free, left: 22 + 6 }, [], two).left).toBe(22)
    expect(snapMove({ ...free, top: 20 - 6 }, [], two).top).toBe(20)
    expect(snapMove({ ...free, top: 1220 - 281 + 5 }, [], two).top).toBe(1220 - 281)
  })

  it('snaps the slot center to the sheet center', () => {
    expect(snapMove({ ...free, left: 922 - 250 + 6 }, [], two).left).toBe(672)
  })

  it('snaps an edge to the cut line only in the 2-strip layout', () => {
    const nearCut = { ...free, top: 620 + 6 }
    expect(snapMove(nearCut, [], two).top).toBe(620)
    expect(snapMove(nearCut, [], one).top).toBe(626)
  })

  it('snaps to the edges and center of another slot, using its rotated box', () => {
    const tall: Slot = { id: 'b', photo: 2, left: 72, top: 70, width: 500, height: 281, angle: 270 }
    const b = slotBounds(tall)
    const right = b.left + b.width
    const moved = snapMove({ ...free, left: right + 5, top: 900 }, [tall], two)
    expect(moved.left).toBeCloseTo(right)
    const centered = snapMove({ ...free, left: b.left + b.width / 2 - 250 + 4, top: 900 }, [tall], two)
    expect(centered.left).toBeCloseTo(b.left + b.width / 2 - 250)
  })

  it('snaps the rotated box of the dragged slot, not its unrotated corner', () => {
    const tall: Slot = { ...free, angle: 270 }
    const b = slotBounds({ ...tall, left: 0, top: 0 })
    // Visible left edge 6 px from x = 0.
    const draft = { ...tall, left: -b.left + 6, top: 300 }
    const snapped = snapMove(draft, [], two)
    expect(slotBounds(snapped).left).toBeCloseTo(0)
  })

  it('picks the nearest target when two are in range', () => {
    // Left at 25: 3 px from the margin 22, 25 px from 0.
    expect(snapMove({ ...free, left: 25 }, [], two).left).toBe(22)
  })
})

describe('snapResize', () => {
  it('snaps the dragged edge and keeps the other one', () => {
    const draft = { ...free, width: 1844 - 300 - 6 }
    const snapped = snapResize(draft, 'e', [], two)
    expect(snapped.left).toBeCloseTo(300)
    expect(snapped.width).toBeCloseTo(1544)
  })

  it('does not snap at 9 px nor with Alt', () => {
    const draft = { ...free, width: 1844 - 300 - 9 }
    expect(snapResize(draft, 'e', [], two).width).toBe(draft.width)
    expect(snapResize({ ...free, width: 1544 - 6 }, 'e', [], { ...two, alt: true }).width).toBe(1538)
  })

  it('maps the handle through a quarter turn', () => {
    // At Angle 270 the local south edge is the visible right edge.
    const tall: Slot = { ...free, angle: 270 }
    const b = slotBounds(tall)
    const gap = 1844 - (b.left + b.width)
    const draft = resizeSlot(tall, 's', { x: gap - 6, y: 0 })
    const after = slotBounds(snapResize(draft, 's', [], two))
    expect(after.left + after.width).toBeCloseTo(1844)
    expect(after.left).toBeCloseTo(b.left)
  })

  it('leaves a tilted slot alone', () => {
    const tilted = { ...free, angle: 30, width: 1000 }
    expect(snapResize(tilted, 'e', [], two)).toBe(tilted)
  })
})

describe('snapAngle', () => {
  it('snaps within 4 degrees of 0, 90, 180 and 270', () => {
    expect(snapAngle(3, { alt: false })).toBe(0)
    expect(snapAngle(357, { alt: false })).toBe(0)
    expect(snapAngle(93, { alt: false })).toBe(90)
    expect(snapAngle(177, { alt: false })).toBe(180)
    expect(snapAngle(273, { alt: false })).toBe(270)
  })

  it('does not snap at 5 degrees nor with Alt', () => {
    expect(snapAngle(5, { alt: false })).toBe(5)
    expect(snapAngle(265, { alt: false })).toBe(265)
    expect(snapAngle(3, { alt: true })).toBe(3)
  })
})
