import { describe, expect, it } from 'vitest'
import { CAMERA_ROTATION_DEG, COPIES, PRINTABLE_AREA, PRINT_MARGIN, SHEET, TV_FRAME } from './constants'

describe('product constants', () => {
  it('rotates the horizontal camera 90° to portrait', () => {
    expect(CAMERA_ROTATION_DEG).toBe(90)
  })

  it('uses the DS-RX1 6×4" print extent at 300 DPI', () => {
    expect(SHEET).toEqual({ width: 1844, height: 1240, dpi: 300 })
    expect(SHEET.width / SHEET.dpi).toBeCloseTo(6.15, 2)
    expect(SHEET.height / SHEET.dpi).toBeCloseTo(4.13, 2)
  })

  it('leaves the 1800×1200 printable area inside the 22/20 margins', () => {
    expect(PRINT_MARGIN).toEqual({ x: 22, y: 20 })
    expect(PRINTABLE_AREA).toEqual({ width: 1800, height: 1200 })
  })

  it('caps copies between 1 and 10', () => {
    expect(COPIES).toEqual({ min: 1, max: 10 })
  })

  it('designs the TV for a 1080×1920 portrait frame', () => {
    expect(TV_FRAME.height).toBeGreaterThan(TV_FRAME.width)
    expect(TV_FRAME).toEqual({ width: 1080, height: 1920 })
  })
})
