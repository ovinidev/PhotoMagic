import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import type { DisplayState } from '@shared/ipc'
import { stubBridge } from '@renderer/test/bridge'
import { TvCard } from './TvCard'

const tv = { id: 2, primary: false, x: 1920, y: 0, width: 1080, height: 1920 }
const landscape = { ...tv, id: 3, width: 1920, height: 1080 }
const portraitClosed: DisplayState = { guest: { kind: 'portrait', display: tv }, tv: { kind: 'closed' } }
const portraitOpen: DisplayState = { guest: { kind: 'portrait', display: tv }, tv: { kind: 'open', display: tv } }

describe('TvCard', () => {
  it('shows loading, then the portrait TV and opens the camera on it', async () => {
    const { api } = stubBridge({
      display: { getState: () => Promise.resolve(portraitClosed) },
      tv: { open: () => Promise.resolve({ ok: true as const, state: portraitOpen }) },
    })
    render(<TvCard />)
    expect(screen.getByText('Procurando a TV…')).toBeInTheDocument()
    expect(await screen.findByText('TV encontrada')).toBeInTheDocument()
    expect(screen.getByText('1080 × 1920, na vertical.')).toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: 'Abrir câmera na TV' }))
    expect(await screen.findByText('Câmera aberta na TV')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Fechar tela da TV' })).toBeEnabled()
    expect(api.tv.close).not.toHaveBeenCalled()
  })

  it('explains that the TV was not found and does not offer to open', async () => {
    stubBridge()
    render(<TvCard />)
    expect(await screen.findByText('TV não encontrada')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Abrir câmera na TV' })).toBeDisabled()
  })

  it('warns about a landscape TV and opens only after confirmation', async () => {
    const { api } = stubBridge({
      display: { getState: () => Promise.resolve({ guest: { kind: 'landscape-external' as const, display: landscape }, tv: { kind: 'closed' as const } }) },
    })
    render(<TvCard />)
    expect(await screen.findByText('A TV não está na vertical')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Abrir mesmo assim' }))
    expect(api.tv.open).toHaveBeenCalledWith({ allowLandscape: true })
  })

  it('follows display:state pushes, such as the TV being unplugged', async () => {
    const { pushDisplay } = stubBridge({ display: { getState: () => Promise.resolve(portraitOpen) } })
    render(<TvCard />)
    expect(await screen.findByText('Câmera aberta na TV')).toBeInTheDocument()
    pushDisplay({ guest: { kind: 'missing' }, tv: { kind: 'detached', reason: 'missing' } })
    expect(await screen.findByText('A TV foi desconectada')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Fechar tela da TV' })).toBeEnabled()
  })

  it('shows an error when the bridge fails, and keeps the button usable', async () => {
    stubBridge({
      display: { getState: () => Promise.resolve(portraitClosed) },
      tv: { open: () => Promise.reject(new Error('ipc down')) },
    })
    render(<TvCard />)
    await userEvent.click(await screen.findByRole('button', { name: 'Abrir câmera na TV' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Não foi possível mudar a tela da TV')
    await waitFor(() => expect(screen.getByRole('button', { name: 'Abrir câmera na TV' })).toBeEnabled())
  })

  it('shows the TV camera state relayed by main', async () => {
    const { pushCamera } = stubBridge()
    render(<TvCard />)
    expect(await screen.findByText('Câmera fechada')).toBeInTheDocument()
    pushCamera({ kind: 'live', label: 'Logitech MX Brio', width: 3840, height: 2160 })
    expect(await screen.findByText('Câmera ao vivo')).toBeInTheDocument()
    expect(screen.getByText('Logitech MX Brio · 3840 × 2160')).toBeInTheDocument()
    pushCamera({ kind: 'error', reason: 'permission-denied' })
    expect(await screen.findByText('Sem permissão para usar a câmera')).toBeInTheDocument()
  })
})
