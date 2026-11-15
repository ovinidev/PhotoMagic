import { describe, expect, it } from 'vitest'
import { clampCopies, stepCopies } from './round'

describe('copies', () => {
  it('Mais goes up to 10 and stops there', () => {
    expect(stepCopies(1, 1)).toBe(2)
    expect(stepCopies(9, 1)).toBe(10)
    expect(stepCopies(10, 1)).toBe(10)
  })

  it('Menos goes down to 1 and stops there', () => {
    expect(stepCopies(2, -1)).toBe(1)
    expect(stepCopies(1, -1)).toBe(1)
  })

  it('clamps and rounds anything else into 1..10', () => {
    expect(clampCopies(0)).toBe(1)
    expect(clampCopies(42)).toBe(10)
    expect(clampCopies(3.4)).toBe(3)
    expect(clampCopies(Number.NaN)).toBe(1)
  })
})
