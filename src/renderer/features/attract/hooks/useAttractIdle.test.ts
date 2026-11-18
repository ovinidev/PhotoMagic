import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useAttractIdle } from './useAttractIdle'

beforeEach(() => vi.useFakeTimers())
afterEach(() => vi.useRealTimers())

describe('useAttractIdle', () => {
  it('shows after the idle time on an active round, and a touch restarts the count', () => {
    const { result } = renderHook(() => useAttractIdle(true, 1_000))
    act(() => vi.advanceTimersByTime(900))
    act(() => window.dispatchEvent(new Event('pointerdown')))
    act(() => vi.advanceTimersByTime(900))
    expect(result.current.showing).toBe(false)
    act(() => vi.advanceTimersByTime(100))
    expect(result.current.showing).toBe(true)
  })

  it('dismiss hides it and counts idle time again from zero', () => {
    const { result } = renderHook(() => useAttractIdle(true, 1_000))
    act(() => vi.advanceTimersByTime(1_000))
    act(() => result.current.dismiss())
    expect(result.current.showing).toBe(false)
    act(() => vi.advanceTimersByTime(999))
    expect(result.current.showing).toBe(false)
    act(() => vi.advanceTimersByTime(1))
    expect(result.current.showing).toBe(true)
  })

  it('never shows while inactive, and hides at once when the round moves on', () => {
    const { result, rerender } = renderHook(({ active }) => useAttractIdle(active, 1_000), { initialProps: { active: false } })
    act(() => vi.advanceTimersByTime(5_000))
    expect(result.current.showing).toBe(false)
    rerender({ active: true })
    act(() => vi.advanceTimersByTime(1_000))
    expect(result.current.showing).toBe(true)
    rerender({ active: false })
    expect(result.current.showing).toBe(false)
    // Back to a fresh round: the count starts over instead of showing at once.
    rerender({ active: true })
    expect(result.current.showing).toBe(false)
  })
})
