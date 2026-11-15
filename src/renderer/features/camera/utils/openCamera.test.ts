import { describe, expect, it, vi } from 'vitest'
import { openCamera, type MediaDevicesLike } from './openCamera'

type Device = { deviceId: string; kind: MediaDeviceKind; label: string }

function fakeTrack(deviceId: string, label: string) {
  return {
    label,
    stop: vi.fn(),
    getSettings: () => ({ deviceId, width: 1920, height: 1080 }),
  }
}

function fakeStream(deviceId: string, label: string) {
  const track = fakeTrack(deviceId, label)
  return { track, stream: { getTracks: () => [track], getVideoTracks: () => [track] } as unknown as MediaStream }
}

/** Fake `mediaDevices`. `labelsAfterOpen` simulates Chromium filling labels once permission exists. */
function fakeMedia(devices: Device[], options: { labelsAfterOpen?: Device[]; fail?: Record<string, string> } = {}) {
  let opened = false
  const streams: Array<ReturnType<typeof fakeStream>> = []
  const media = {
    enumerateDevices: vi.fn(async () => (opened && options.labelsAfterOpen ? options.labelsAfterOpen : devices) as MediaDeviceInfo[]),
    getUserMedia: vi.fn(async (constraints?: MediaStreamConstraints) => {
      const video = constraints?.video as { deviceId?: { exact: string } }
      const id = video.deviceId?.exact ?? devices.find((d) => d.kind === 'videoinput')?.deviceId ?? ''
      const failure = options.fail?.[id]
      if (failure) throw new DOMException('fail', failure)
      opened = true
      const label = (options.labelsAfterOpen ?? devices).find((d) => d.deviceId === id)?.label ?? ''
      const created = fakeStream(id, label)
      streams.push(created)
      return created.stream
    }),
  } satisfies MediaDevicesLike
  return { media, streams }
}

const integrated: Device = { deviceId: 'int', kind: 'videoinput', label: 'Integrated Webcam' }
const brio: Device = { deviceId: 'brio', kind: 'videoinput', label: 'Logitech MX Brio' }
const mic: Device = { deviceId: 'mic', kind: 'audioinput', label: 'Microphone' }

describe('openCamera', () => {
  it('opens the MX Brio at 1920×1080 ideal, without audio', async () => {
    const { media } = fakeMedia([integrated, brio, mic])
    const camera = await openCamera(media)
    expect(media.getUserMedia).toHaveBeenCalledWith({
      audio: false,
      video: { deviceId: { exact: 'brio' }, width: { ideal: 1920 }, height: { ideal: 1080 }, frameRate: { ideal: 30 } },
    })
    expect(camera).toMatchObject({ label: 'Logitech MX Brio', width: 1920, height: 1080 })
  })

  it('falls back to the first camera without a Brio', async () => {
    const { media } = fakeMedia([mic, integrated])
    expect((await openCamera(media)).label).toBe('Integrated Webcam')
  })

  it('rejects with NotFoundError when there is no camera', async () => {
    const { media } = fakeMedia([mic])
    await expect(openCamera(media)).rejects.toMatchObject({ name: 'NotFoundError' })
    expect(media.getUserMedia).not.toHaveBeenCalled()
  })

  it('switches to the Brio once permission reveals the labels', async () => {
    const blind = [
      { ...integrated, label: '' },
      { ...brio, label: '' },
    ]
    const { media, streams } = fakeMedia(blind, { labelsAfterOpen: [integrated, brio] })
    const camera = await openCamera(media)
    expect(streams[0]!.track.stop).toHaveBeenCalled()
    expect(camera.label).toBe('Logitech MX Brio')
  })

  it('takes any camera when the chosen one vanished before opening', async () => {
    const replacement = fakeStream('int', 'Integrated Webcam')
    const media = {
      enumerateDevices: vi.fn(async () => [brio, integrated] as MediaDeviceInfo[]),
      getUserMedia: vi
        .fn<MediaDevicesLike['getUserMedia']>()
        .mockRejectedValueOnce(new DOMException('gone', 'OverconstrainedError'))
        .mockResolvedValueOnce(replacement.stream),
    } satisfies MediaDevicesLike
    const camera = await openCamera(media)
    expect(media.getUserMedia).toHaveBeenCalledTimes(2)
    expect(media.getUserMedia.mock.calls[1]?.[0]?.video).not.toHaveProperty('deviceId')
    expect(camera.label).toBe('Integrated Webcam')
  })

  it('passes a permission error through', async () => {
    const { media } = fakeMedia([brio], { fail: { brio: 'NotAllowedError' } })
    await expect(openCamera(media)).rejects.toMatchObject({ name: 'NotAllowedError' })
  })
})
