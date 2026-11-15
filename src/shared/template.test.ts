import { describe, expect, it } from 'vitest'
import { checkTemplate } from './template'

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
