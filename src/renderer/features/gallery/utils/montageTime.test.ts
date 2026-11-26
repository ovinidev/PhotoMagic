import { describe, expect, it } from 'vitest'
import { montageTime } from './montageTime'

describe('montageTime', () => {
  it('reads the print time from the file name', () => {
    expect(montageTime('21-45-08.jpg')).toBe('21:45:08')
    expect(montageTime('07-58-00-2.jpg')).toBe('07:58:00 (2)')
  })

  it('shows any other name as is', () => {
    expect(montageTime('foto.jpg')).toBe('foto.jpg')
  })
})
