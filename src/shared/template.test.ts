import { describe, expect, it } from 'vitest'
import { checkTemplate, isPdf } from './template'

describe('checkTemplate (RF01)', () => {
  it.each(['png', 'jpeg'])('accepts a 1844×1240 %s', (format) => {
    expect(checkTemplate({ format, width: 1844, height: 1240 })).toEqual({ ok: true })
  })

  it.each([
    [1240, 1844],
    [1800, 1200],
    [3688, 2480],
  ])('rejects %i×%i and reports the size read', (width, height) => {
    expect(checkTemplate({ format: 'png', width, height })).toEqual({ ok: false, reason: 'size', width, height })
  })

  it.each(['webp', 'gif', 'svg', undefined])('rejects the format %s', (format) => {
    expect(checkTemplate({ format, width: 1844, height: 1240 })).toEqual({ ok: false, reason: 'format' })
  })
})

describe('isPdf', () => {
  it('recognizes the %PDF- header only', () => {
    expect(isPdf(new TextEncoder().encode('%PDF-1.4'))).toBe(true)
    expect(isPdf(new TextEncoder().encode('%PD'))).toBe(false)
    expect(isPdf(new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d]))).toBe(false)
  })
})
