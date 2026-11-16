import { describe, expect, it } from 'vitest'
import { zoomKeyStep } from './useZoom'

const key = (key: string, extra: Partial<KeyboardEvent> = {}) =>
  ({ key, code: '', ctrlKey: true, metaKey: false, altKey: false, ...extra }) as KeyboardEvent

describe('zoomKeyStep', () => {
  it('maps Ctrl + / Ctrl = / Ctrl − / Ctrl 0 and the numpad to a zoom step', () => {
    expect(zoomKeyStep(key('+'))).toBe('in')
    expect(zoomKeyStep(key('='))).toBe('in')
    expect(zoomKeyStep(key('', { code: 'NumpadAdd' }))).toBe('in')
    expect(zoomKeyStep(key('-'))).toBe('out')
    expect(zoomKeyStep(key('0'))).toBe('reset')
  })

  it('ignores keys without Ctrl, with Alt, and other keys', () => {
    expect(zoomKeyStep(key('+', { ctrlKey: false }))).toBeNull()
    expect(zoomKeyStep(key('+', { altKey: true }))).toBeNull()
    expect(zoomKeyStep(key('z'))).toBeNull()
  })
})
