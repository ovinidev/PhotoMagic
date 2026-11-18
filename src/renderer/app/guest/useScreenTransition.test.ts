import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { GUEST_TRANSITION_MS, type GuestScreen } from './screens'
import { useScreenTransition } from './useScreenTransition'

describe('useScreenTransition', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  const render = () =>
    renderHook(({ screen, payload }: { screen: GuestScreen; payload: string }) => useScreenTransition(screen, payload), {
      initialProps: { screen: 'camera', payload: 'a' },
    })

  it('starts with no direction and nothing leaving', () => {
    const { result } = render()
    expect(result.current.direction).toBe('none')
    expect(result.current.leaving).toBeNull()
  })

  it('goes forward without a leaving screen', () => {
    const { result, rerender } = render()
    rerender({ screen: 'print', payload: 'b' })
    expect(result.current.direction).toBe('forward')
    expect(result.current.leaving).toBeNull()
  })

  it('keeps the previous screen with its last payload on back, then drops it', () => {
    const { result, rerender } = render()
    rerender({ screen: 'print', payload: 'b' })
    rerender({ screen: 'camera', payload: 'c' })
    expect(result.current.direction).toBe('back')
    expect(result.current.leaving).toEqual({ screen: 'print', payload: 'b' })

    act(() => vi.advanceTimersByTime(GUEST_TRANSITION_MS + 100))
    expect(result.current.leaving).toBeNull()
  })

  it('drops the leaving screen when its animation ends', () => {
    const { result, rerender } = render()
    rerender({ screen: 'print', payload: 'b' })
    rerender({ screen: 'camera', payload: 'c' })
    act(() => result.current.endLeaving())
    expect(result.current.leaving).toBeNull()
  })
})
