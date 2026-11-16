import { describe, expect, it } from 'vitest'
import { AUTO_ZOOM_RANGE, autoZoom, effectiveZoom, sanitizeUserZoom, stepUserZoom } from './zoom'

describe('autoZoom', () => {
  it('stays at 1 at the reference size and on a 1366×768 screen', () => {
    expect(autoZoom({ width: 1280, height: 760 })).toBe(1)
    expect(autoZoom({ width: 1366, height: 705 })).toBe(1)
  })

  it('grows with a maximized 1080p window, limited by the smaller ratio', () => {
    expect(autoZoom({ width: 1920, height: 1017 })).toBe(1.34)
    expect(autoZoom({ width: 2560, height: 760 })).toBe(1)
  })

  it('never passes the maximum and survives an empty size', () => {
    expect(autoZoom({ width: 7680, height: 4320 })).toBe(AUTO_ZOOM_RANGE.max)
    expect(autoZoom({ width: 0, height: 0 })).toBe(1)
  })
})

describe('stepUserZoom', () => {
  it('steps like a browser and stops at both ends', () => {
    expect(stepUserZoom(1, 'in')).toBe(1.1)
    expect(stepUserZoom(1, 'out')).toBe(0.9)
    expect(stepUserZoom(2, 'in')).toBe(2)
    expect(stepUserZoom(0.67, 'out')).toBe(0.67)
    expect(stepUserZoom(1.5, 'reset')).toBe(1)
  })

  it('steps from the nearest step when the stored value is between steps', () => {
    expect(stepUserZoom(1.2, 'in')).toBe(1.5)
  })
})

describe('sanitizeUserZoom and effectiveZoom', () => {
  it('falls back to 1 for a value outside the steps', () => {
    expect(sanitizeUserZoom('big')).toBe(1)
    expect(sanitizeUserZoom(9)).toBe(1)
    expect(sanitizeUserZoom(1.25)).toBe(1.25)
  })

  it('multiplies the automatic factor by the operator zoom', () => {
    expect(effectiveZoom(1.34, 1.25)).toBe(1.68)
  })
})
