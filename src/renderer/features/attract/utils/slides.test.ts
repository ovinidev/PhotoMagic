import { describe, expect, it } from 'vitest'
import { ATTRACT_PHOTO_LIMIT, nextSlide, recentSlides } from './slides'

describe('recentSlides', () => {
  it('keeps the newest montages up to the limit, in gallery order', () => {
    const names = Array.from({ length: 20 }, (_, index) => `10-00-${String(59 - index).padStart(2, '0')}.jpg`)
    const slides = recentSlides(names)
    expect(slides).toHaveLength(ATTRACT_PHOTO_LIMIT)
    expect(slides[0]).toBe('10-00-59.jpg')
    expect(slides.at(-1)).toBe(names[ATTRACT_PHOTO_LIMIT - 1])
  })

  it('returns fewer when the event has fewer, and none for a bad limit', () => {
    expect(recentSlides(['a.jpg', 'b.jpg'])).toEqual(['a.jpg', 'b.jpg'])
    expect(recentSlides([])).toEqual([])
    expect(recentSlides(['a.jpg'], -1)).toEqual([])
  })
})

describe('nextSlide', () => {
  it('advances and wraps around', () => {
    expect(nextSlide(0, 3)).toBe(1)
    expect(nextSlide(2, 3)).toBe(0)
    expect(nextSlide(0, 1)).toBe(0)
    expect(nextSlide(4, 0)).toBe(0)
  })
})
