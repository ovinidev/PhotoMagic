import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import type { ShareState } from '@shared/ipc'
import { defaultShareSettings } from '@shared/share'
import { SHARE_OFF, stubBridge } from '@renderer/test/bridge'
import { EventGalleryQr } from './EventGalleryQr'
import { ShareQrPanel } from './ShareQrPanel'
import { ShareSettingsCard } from './ShareSettingsCard'

const RUNNING: ShareState = {
  status: 'running',
  error: null,
  host: '192.168.137.1',
  port: 8787,
  ssid: 'Festa',
  wifiQr: 'WIFI:T:WPA;S:Festa;P:segredo;;',
  url: 'http://192.168.137.1:8787/p/abc',
  galleryUrl: 'http://192.168.137.1:8787/e/xyz',
}

describe('ShareQrPanel (DESIGN §17)', () => {
  it('shows nothing until the round has a link', () => {
    const { container } = render(<ShareQrPanel state={SHARE_OFF} />)
    expect(container).toBeEmptyDOMElement()
  })

  it('shows the Wi-Fi QR first, then the photo link', () => {
    stubBridge()
    render(<ShareQrPanel state={RUNNING} />)
    expect(screen.getByText('1. Conecte-se ao Wi-Fi')).toBeInTheDocument()
    expect(screen.getByText('2. Escaneie para baixar')).toBeInTheDocument()
    expect(screen.getByTestId('share-qr-wifi')).toHaveAttribute('data-qr-text', RUNNING.wifiQr)
    expect(screen.getByTestId('share-qr-link')).toHaveAttribute('data-qr-text', RUNNING.url)
  })

  it('leaves out the Wi-Fi step without an SSID', () => {
    render(<ShareQrPanel state={{ ...RUNNING, ssid: '', wifiQr: null }} />)
    expect(screen.queryByTestId('share-qr-wifi')).toBeNull()
    expect(screen.getByText('1. Escaneie para baixar')).toBeInTheDocument()
  })
})

describe('ShareSettingsCard (DESIGN §17)', () => {
  it('starts collapsed to one row with the status', async () => {
    stubBridge()
    render(<ShareSettingsCard />)
    const toggle = await screen.findByRole('button', { name: 'Configurar' })
    expect(toggle).toHaveAttribute('aria-expanded', 'false')
    expect(screen.queryByLabelText('Nome do Wi-Fi (SSID)')).toBeNull()
    expect(screen.getByTestId('share-status')).toHaveTextContent('Desligado')
  })

  it('opens the fields in a dialog and closes it with Escape', async () => {
    stubBridge()
    render(<ShareSettingsCard />)
    fireEvent.click(await screen.findByRole('button', { name: 'Configurar' }))
    expect(screen.getByRole('dialog', { name: 'Foto no celular' })).toBeInTheDocument()
    fireEvent.keyDown(window, { key: 'Escape' })
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('saves the Wi-Fi and the address', async () => {
    const { api } = stubBridge({ share: { saveSettings: () => Promise.resolve(RUNNING) } })
    render(<ShareSettingsCard />)
    fireEvent.click(await screen.findByRole('button', { name: 'Configurar' }))
    fireEvent.click(screen.getByLabelText('Mostrar QR code para baixar a foto'))
    fireEvent.change(screen.getByLabelText('Nome do Wi-Fi (SSID)'), { target: { value: 'Festa' } })
    fireEvent.change(screen.getByLabelText('Senha do Wi-Fi'), { target: { value: 'segredo' } })
    fireEvent.change(screen.getByLabelText('Endereço do notebook'), { target: { value: '192.168.137.1' } })
    fireEvent.click(screen.getByRole('button', { name: 'Salvar' }))
    const expected = { ...defaultShareSettings(), enabled: true, hostOverride: '192.168.137.1', wifi: { ...defaultShareSettings().wifi, ssid: 'Festa', password: 'segredo' } }
    await waitFor(() => expect(api.share.saveSettings).toHaveBeenCalledWith(expected))
    expect(await screen.findByText(/Ativo em http:\/\/192\.168\.137\.1:8787/)).toBeInTheDocument()
  })

  it('refuses a bad address without saving', async () => {
    const { api } = stubBridge()
    render(<ShareSettingsCard />)
    fireEvent.click(await screen.findByRole('button', { name: 'Configurar' }))
    fireEvent.click(screen.getByLabelText('Mostrar QR code para baixar a foto'))
    fireEvent.change(screen.getByLabelText('Endereço do notebook'), { target: { value: '192.168.1' } })
    fireEvent.click(screen.getByRole('button', { name: 'Salvar' }))
    expect(await screen.findByText(/Confira a porta/)).toBeInTheDocument()
    expect(api.share.saveSettings).not.toHaveBeenCalled()
  })
})

describe('EventGalleryQr (DESIGN §17)', () => {
  it('shows nothing without an event gallery link', () => {
    const { container } = render(<EventGalleryQr state={{ ...RUNNING, galleryUrl: null }} />)
    expect(container).toBeEmptyDOMElement()
  })

  it('shows the gallery QR and the Wi-Fi QR beside it', () => {
    stubBridge()
    render(<EventGalleryQr state={RUNNING} />)
    expect(screen.getByText('Galeria do evento no celular')).toBeInTheDocument()
    expect(screen.getByTestId('event-gallery-qr-link')).toHaveAttribute('data-qr-text', RUNNING.galleryUrl)
    expect(screen.getByTestId('event-gallery-qr-wifi')).toHaveAttribute('data-qr-text', RUNNING.wifiQr)
  })

  it('leaves the Wi-Fi QR out with no SSID', () => {
    stubBridge()
    render(<EventGalleryQr state={{ ...RUNNING, ssid: '', wifiQr: null }} />)
    expect(screen.getByTestId('event-gallery-qr-link')).toBeInTheDocument()
    expect(screen.queryByTestId('event-gallery-qr-wifi')).toBeNull()
  })
})
