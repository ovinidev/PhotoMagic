import { act, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { stubBridge, type BridgeStub } from '@renderer/test/bridge'
import { CameraView } from './CameraView'

class FakeMediaDevices extends EventTarget {
  enumerateDevices = vi.fn(async () => [] as MediaDeviceInfo[])
  getUserMedia = vi.fn<MediaDevices['getUserMedia']>()
}

function liveStream() {
  const track = Object.assign(new EventTarget(), {
    label: 'Logitech MX Brio',
    stop: vi.fn(),
    getSettings: () => ({ deviceId: 'brio', width: 3840, height: 2160 }),
  })
  return { track, stream: { getTracks: () => [track], getVideoTracks: () => [track] } as unknown as MediaStream }
}

const brio = { deviceId: 'brio', kind: 'videoinput', label: 'Logitech MX Brio' } as MediaDeviceInfo

let media: FakeMediaDevices
let bridge: BridgeStub

beforeEach(() => {
  media = new FakeMediaDevices()
  Object.defineProperty(navigator, 'mediaDevices', { value: media, configurable: true })
  // jsdom has no canvas: the preview simply does not draw.
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null)
  bridge = stubBridge()
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('CameraView', () => {
  it('shows the loading state, then the live preview, and reports both to main', async () => {
    const { stream } = liveStream()
    media.enumerateDevices.mockResolvedValue([brio])
    media.getUserMedia.mockResolvedValue(stream)
    render(<CameraView />)

    expect(screen.getByText('Abrindo a câmera…')).toBeInTheDocument()
    expect(await screen.findByTestId('camera-preview')).toBeInTheDocument()
    expect(bridge.api.camera.report).toHaveBeenCalledWith({ kind: 'starting' })
    // The report is a passive effect: it may run just after the DOM shows the state.
    await waitFor(() => expect(bridge.api.camera.report).toHaveBeenLastCalledWith({ kind: 'live', label: 'Logitech MX Brio', width: 3840, height: 2160 }))
  })

  it('explains a missing camera in pt-BR and opens it when one is plugged in', async () => {
    render(<CameraView />)
    expect(await screen.findByText('Nenhuma câmera encontrada')).toBeInTheDocument()
    // The report is a passive effect: it may run just after the DOM shows the state.
    await waitFor(() => expect(bridge.api.camera.report).toHaveBeenLastCalledWith({ kind: 'error', reason: 'not-found' }))

    const { stream } = liveStream()
    media.enumerateDevices.mockResolvedValue([brio])
    media.getUserMedia.mockResolvedValue(stream)
    act(() => {
      media.dispatchEvent(new Event('devicechange'))
    })
    expect(await screen.findByTestId('camera-preview')).toBeInTheDocument()
  })

  it('shows the permission error with a 64 px retry button that tries again', async () => {
    media.enumerateDevices.mockResolvedValue([brio])
    media.getUserMedia.mockRejectedValue(new DOMException('denied', 'NotAllowedError'))
    render(<CameraView />)

    const retry = await screen.findByRole('button', { name: 'Tentar novamente' })
    expect(screen.getByText('Sem permissão para usar a câmera')).toBeInTheDocument()
    expect(retry).toHaveClass('min-h-16', 'min-w-16', 'cursor-pointer')

    await userEvent.click(retry)
    await waitFor(() => expect(media.getUserMedia).toHaveBeenCalledTimes(2))
  })

  it('turns an unplugged camera into the disconnected warning', async () => {
    const { stream, track } = liveStream()
    media.enumerateDevices.mockResolvedValue([brio])
    media.getUserMedia.mockResolvedValue(stream)
    render(<CameraView />)
    await screen.findByTestId('camera-preview')

    act(() => {
      track.dispatchEvent(new Event('ended'))
    })
    expect(await screen.findByText('A câmera foi desconectada')).toBeInTheDocument()
    // The report is a passive effect: it may run just after the DOM shows the state.
    await waitFor(() => expect(bridge.api.camera.report).toHaveBeenLastCalledWith({ kind: 'error', reason: 'disconnected' }))
  })
})
