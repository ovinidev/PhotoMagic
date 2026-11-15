import { act, fireEvent, render, renderHook, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { WebcamState } from '@shared/ipc'
import { stubBridge } from '@renderer/test/bridge'
import { useApplyWebcam } from '../hooks/useApplyWebcam'
import { WebcamPanel } from './WebcamPanel'

const CAPS: NonNullable<WebcamState['capabilities']> = {
  controls: {
    brightness: { key: 'brightness', min: 0, max: 255, step: 1 },
    colorTemperature: { key: 'colorTemperature', min: 2000, max: 7500, step: 10 },
  },
  whiteBalanceModes: ['continuous', 'manual'],
  powerLineFrequency: false,
}

describe('WebcamPanel (RF15)', () => {
  it('draws only the advertised controls and saves a change', async () => {
    const state: WebcamState = { values: { controls: { brightness: 120 }, whiteBalanceMode: 'continuous' }, capabilities: CAPS, live: true }
    const { api } = stubBridge({ webcam: { getState: () => Promise.resolve(state) } })
    render(<WebcamPanel surface="laptop" />)
    const brightness = await screen.findByLabelText('Brilho')
    expect(brightness).toHaveValue('120')
    expect(screen.queryByLabelText('Contraste')).toBeNull()
    expect(screen.queryByLabelText('Compensação de luz de fundo')).toBeNull()
    // Color temperature only in manual white balance.
    expect(screen.queryByLabelText('Temperatura de cor')).toBeNull()
    fireEvent.change(screen.getByLabelText('Balanço de branco'), { target: { value: 'manual' } })
    expect(screen.getByLabelText('Temperatura de cor')).toBeInTheDocument()

    fireEvent.change(brightness, { target: { value: '150' } })
    await waitFor(() => expect(api.webcam.set).toHaveBeenLastCalledWith({ controls: { brightness: 150 }, whiteBalanceMode: 'manual' }))
  })

  it('opens with the saved controls when no camera is open, and does not throw', async () => {
    stubBridge({ webcam: { getState: () => Promise.resolve({ values: { controls: { brightness: 90 } }, capabilities: CAPS, live: false }) } })
    render(<WebcamPanel surface="tv" />)
    expect(await screen.findByLabelText('Brilho')).toHaveValue('90')
    expect(screen.getByText(/A câmera não está aberta/)).toBeInTheDocument()
  })

  it('says so when nothing was ever saved', async () => {
    stubBridge()
    render(<WebcamPanel surface="laptop" />)
    expect(await screen.findByText(/Nenhum ajuste salvo/)).toBeInTheDocument()
  })
})

describe('useApplyWebcam (RF15)', () => {
  it('reports the capabilities and applies the saved values to the track', async () => {
    const { api } = stubBridge({ webcam: { getState: () => Promise.resolve({ values: { controls: { brightness: 300 } }, capabilities: null, live: false }) } })
    const track = {
      getCapabilities: () => ({ brightness: { min: 0, max: 255, step: 1 }, powerLineFrequency: [50, 60] }),
      applyConstraints: vi.fn(() => Promise.resolve()),
    }
    renderHook(() => useApplyWebcam(track))
    await waitFor(() => expect(track.applyConstraints).toHaveBeenCalledWith({ advanced: [{ brightness: 255, powerLineFrequency: 60 }] }))
    expect(api.webcam.report).toHaveBeenCalledWith({ capabilities: expect.objectContaining({ powerLineFrequency: true }) })
  })

  it('reports no camera with a null track', async () => {
    const { api } = stubBridge()
    renderHook(() => useApplyWebcam(null))
    await act(async () => {})
    expect(api.webcam.report).toHaveBeenCalledWith({ capabilities: null })
  })
})
