import { describe, expect, it } from 'vitest'
import { CANVAS_ZOOM, clampCanvasZoom, fitSheetWidth, scrollForZoom, stepCanvasZoom } from './canvasZoom'

const SHEET = { width: 1844, height: 1240 }

describe('canvas zoom', () => {
  it('steps by 1.25 between fit and 4×', () => {
    expect(stepCanvasZoom(1, 'in')).toBe(1.25)
    expect(stepCanvasZoom(1.25, 'out')).toBe(1)
    expect(stepCanvasZoom(1, 'out')).toBe(CANVAS_ZOOM.min)
    expect(stepCanvasZoom(3.9, 'in')).toBe(CANVAS_ZOOM.max)
    expect(clampCanvasZoom(Number.NaN)).toBe(1)
  })

  it('fits the sheet by width or by height, keeping its proportion', () => {
    expect(fitSheetWidth({ width: 922, height: 2000 }, SHEET)).toBe(922)
    expect(fitSheetWidth({ width: 2000, height: 620 }, SHEET)).toBe(922)
    expect(fitSheetWidth({ width: -5, height: 100 }, SHEET)).toBe(0)
  })

  it('keeps the point under the cursor in place when zooming', () => {
    // Content x under the cursor: (scroll + anchor) / zoom must not change.
    const scroll = scrollForZoom(100, 300, 1, 2)
    expect((scroll + 300) / 2).toBe((100 + 300) / 1)
    expect(scrollForZoom(0, 0, 2, 1)).toBe(0)
    expect(scrollForZoom(10, 50, 2, 1)).toBe(0)
  })
})
