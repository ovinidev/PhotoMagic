import { afterEach, describe, expect, it, vi } from 'vitest'
import { waitForFrame } from './waitForFrame'

function fakeVideo(readyState: number, videoWidth: number) {
  const target = new EventTarget()
  return Object.assign(target, { readyState, videoWidth }) as EventTarget & { readyState: number; videoWidth: number }
}

afterEach(() => {
  vi.useRealTimers()
})

describe('waitForFrame', () => {
  it('resolves at once when a frame is decoded', async () => {
    await expect(waitForFrame(fakeVideo(4, 640) as unknown as HTMLVideoElement)).resolves.toBeUndefined()
  })

  it('waits for the first frame', async () => {
    const video = fakeVideo(0, 0)
    const waiting = waitForFrame(video as unknown as HTMLVideoElement)
    Object.assign(video, { readyState: 2, videoWidth: 640 })
    video.dispatchEvent(new Event('loadeddata'))
    await expect(waiting).resolves.toBeUndefined()
  })

  it('gives up after the timeout', async () => {
    vi.useFakeTimers()
    const waiting = waitForFrame(fakeVideo(0, 0) as unknown as HTMLVideoElement, 1000)
    vi.advanceTimersByTime(1000)
    await expect(waiting).rejects.toThrow('frame')
  })
})
