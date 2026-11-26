import { describe, expect, it } from 'vitest'
import { centerIn, chooseGuestDisplay, placeGuestWindow, tvZoomFactor, type DisplayInfo } from './displays'

const laptop: DisplayInfo = { id: 1, primary: true, x: 0, y: 0, width: 1920, height: 1080 }
const tv: DisplayInfo = { id: 2, primary: false, x: 1920, y: 0, width: 1080, height: 1920 }
const tvLandscape: DisplayInfo = { id: 3, primary: false, x: 1920, y: 0, width: 1920, height: 1080 }
const tallMonitor: DisplayInfo = { id: 4, primary: false, x: -1200, y: 0, width: 1200, height: 1920 }

describe('chooseGuestDisplay', () => {
  it('picks the portrait external monitor', () => {
    expect(chooseGuestDisplay([laptop, tv])).toEqual({ kind: 'portrait', display: tv })
  })

  it('prefers the portrait monitor closest to 9:16, whatever the list order', () => {
    expect(chooseGuestDisplay([laptop, tallMonitor, tv])).toEqual({ kind: 'portrait', display: tv })
    expect(chooseGuestDisplay([tv, laptop, tallMonitor])).toEqual({ kind: 'portrait', display: tv })
  })

  it('prefers a portrait external over a landscape one', () => {
    expect(chooseGuestDisplay([laptop, tvLandscape, tallMonitor])).toEqual({ kind: 'portrait', display: tallMonitor })
  })

  it('reports a landscape external when it is the only other monitor', () => {
    expect(chooseGuestDisplay([laptop, tvLandscape])).toEqual({ kind: 'landscape-external', display: tvLandscape })
  })

  it('treats a square external as not portrait', () => {
    const square = { ...tv, width: 1500, height: 1500 }
    expect(chooseGuestDisplay([laptop, square])).toEqual({ kind: 'landscape-external', display: square })
  })

  it('reports missing with only the primary, even if the primary is portrait', () => {
    expect(chooseGuestDisplay([laptop])).toEqual({ kind: 'missing' })
    expect(chooseGuestDisplay([{ ...tv, primary: true }])).toEqual({ kind: 'missing' })
    expect(chooseGuestDisplay([])).toEqual({ kind: 'missing' })
  })
})

describe('placeGuestWindow', () => {
  it('shows the window on the chosen portrait TV', () => {
    expect(placeGuestWindow({ displays: [laptop, tv], currentDisplayId: null })).toEqual({
      kind: 'show',
      display: tv,
    })
  })

  it('hides the window when the TV is unplugged instead of moving it to the laptop', () => {
    expect(placeGuestWindow({ displays: [laptop], currentDisplayId: tv.id })).toEqual({
      kind: 'hide',
      reason: 'missing',
    })
  })

  it('stays on the current TV when another portrait monitor appears', () => {
    expect(
      placeGuestWindow({ displays: [laptop, tv, tallMonitor], currentDisplayId: tallMonitor.id }),
    ).toEqual({ kind: 'show', display: tallMonitor })
  })

  it('follows the current TV when its bounds change', () => {
    const moved = { ...tv, x: -1080 }
    expect(placeGuestWindow({ displays: [laptop, moved], currentDisplayId: tv.id })).toEqual({
      kind: 'show',
      display: moved,
    })
  })

  it('always hides on a landscape TV', () => {
    expect(placeGuestWindow({ displays: [laptop, tvLandscape], currentDisplayId: null })).toEqual({ kind: 'hide', reason: 'landscape' })
    expect(placeGuestWindow({ displays: [laptop, tvLandscape], currentDisplayId: tvLandscape.id })).toEqual({ kind: 'hide', reason: 'landscape' })
  })

  it('leaves a TV that was rotated to landscape unless landscape was confirmed', () => {
    const rotated = { ...tv, width: 1920, height: 1080 }
    expect(placeGuestWindow({ displays: [laptop, rotated], currentDisplayId: tv.id })).toEqual({
      kind: 'hide',
      reason: 'landscape',
    })
  })
})

describe('tvZoomFactor', () => {
  it('is 1 on the 1080×1920 reference TV', () => {
    expect(tvZoomFactor({ width: 1080, height: 1920 })).toBe(1)
  })

  it('scales the logical frame up on a 4K portrait panel at 100 %', () => {
    expect(tvZoomFactor({ width: 2160, height: 3840 })).toBe(2)
  })

  it('fits the frame on the tighter axis of a landscape monitor', () => {
    expect(tvZoomFactor({ width: 1920, height: 1080 })).toBeCloseTo(1080 / 1920)
  })
})

describe('centerIn', () => {
  it('centers a window inside the primary work area', () => {
    expect(centerIn({ x: 0, y: 0, width: 1920, height: 1040 }, { width: 1280, height: 800 })).toEqual({ x: 320, y: 120 })
  })

  it('keeps the corner on the area origin when the window is larger', () => {
    expect(centerIn({ x: 100, y: 50, width: 1000, height: 700 }, { width: 1280, height: 800 })).toEqual({ x: 100, y: 50 })
  })
})
