import { act, renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { EventSession } from '@shared/ipc'
import { eventState, stubBridge, type BridgeStub } from '@renderer/test/bridge'
import { useShutter } from './useShutter'

const video = { current: {} as HTMLVideoElement }
const JPEG = new Uint8Array([0xff, 0xd8])

let bridge: BridgeStub
beforeEach(() => {
  bridge = stubBridge()
})

function setup(session: EventSession) {
  const capture = vi.fn(async () => JPEG)
  const waits: Array<() => void> = []
  const wait = vi.fn(() => new Promise<void>((resolve) => waits.push(resolve)))
  const hook = renderHook((props: { session: EventSession }) => useShutter({ session: props.session, videoRef: video, capture, wait }), {
    initialProps: { session },
  })
  return { hook, capture, wait, waits }
}

const flush = () => act(async () => {})

describe('useShutter', () => {
  it('captures at once with the timer off and sends the next photo index (RF06)', async () => {
    const { hook, capture } = setup(eventState({ taken: 1 }))
    act(() => hook.result.current.trigger())
    await flush()
    expect(capture).toHaveBeenCalledTimes(1)
    expect(bridge.api.session.sendPhoto).toHaveBeenCalledWith({ index: 2, jpeg: JPEG })
  })

  it('ignores taps while a capture is pending, until main counts the photo', async () => {
    const { hook, capture } = setup(eventState({ taken: 0 }))
    act(() => hook.result.current.trigger())
    act(() => hook.result.current.trigger())
    await flush()
    expect(capture).toHaveBeenCalledTimes(1)
    expect(hook.result.current.busy).toBe(true)

    hook.rerender({ session: eventState({ taken: 1 }) })
    expect(hook.result.current.busy).toBe(false)
    act(() => hook.result.current.trigger())
    await flush()
    expect(bridge.api.session.sendPhoto).toHaveBeenLastCalledWith({ index: 2, jpeg: JPEG })
  })

  it('counts down 5, 4, 3, 2, 1 before capturing (RF07)', async () => {
    const { hook, capture, waits } = setup(eventState({ timer: 5 }))
    act(() => hook.result.current.trigger())
    const seen: Array<number | null> = []
    for (let step = 0; step < 5; step++) {
      await flush()
      seen.push(hook.result.current.countdown)
      expect(capture).not.toHaveBeenCalled()
      // A tap during the countdown adds nothing.
      act(() => hook.result.current.trigger())
      await act(async () => waits.shift()?.())
    }
    await flush()
    expect(seen).toEqual([5, 4, 3, 2, 1])
    expect(hook.result.current.countdown).toBeNull()
    expect(capture).toHaveBeenCalledTimes(1)
  })

  it('does nothing outside capturing', async () => {
    const { hook, capture } = setup(eventState({ taken: 3, phase: { kind: 'review' } }))
    act(() => hook.result.current.trigger())
    await flush()
    expect(capture).not.toHaveBeenCalled()
  })

  it('runs the same capture when the laptop asks (session:shutter)', async () => {
    const { capture } = setup(eventState())
    act(() => bridge.pushShutter())
    await flush()
    expect(capture).toHaveBeenCalledTimes(1)
    expect(bridge.api.session.sendPhoto).toHaveBeenCalledWith({ index: 1, jpeg: JPEG })
  })

  it('unlocks and reports a failed capture', async () => {
    const { hook, capture } = setup(eventState())
    capture.mockRejectedValueOnce(new Error('no frame'))
    act(() => hook.result.current.trigger())
    await flush()
    expect(hook.result.current.failed).toBe(true)
    expect(hook.result.current.busy).toBe(false)
  })
})
