import { act, renderHook } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { stubBridge } from '@renderer/test/bridge'
import { FRAMING_SEND_INTERVAL_MS, useFramingSender } from './useFramingSender'

const framing = (zoom: number) => ({ zoom, panX: 0, panY: 0, rotation: 0 })

describe('useFramingSender (DESIGN §8)', () => {
  afterEach(() => vi.useRealTimers())

  it('sends a drag to main at most 5 times a second, then the release at once', async () => {
    vi.useFakeTimers()
    const { api } = stubBridge()
    const { result } = renderHook(() => useFramingSender())
    const send = result.current
    await act(async () => {
      for (let step = 0; step < 50; step += 1) {
        send('bottom-1', framing(1 + step / 100))
        await vi.advanceTimersByTimeAsync(10)
      }
    })
    // 500 ms of pointer moves every 10 ms: the first at once, then one per 200 ms.
    expect(api.session.setFraming.mock.calls.length).toBeLessThanOrEqual(1 + Math.ceil(500 / FRAMING_SEND_INTERVAL_MS))
    await act(async () => {
      send('bottom-1', framing(2), { final: true })
      await vi.advanceTimersByTimeAsync(0)
    })
    expect(api.session.setFraming).toHaveBeenLastCalledWith({ slotId: 'bottom-1', framing: framing(2) })
    const calls = api.session.setFraming.mock.calls.length
    await act(() => vi.advanceTimersByTimeAsync(1000))
    expect(api.session.setFraming.mock.calls.length).toBe(calls)
  })
})
