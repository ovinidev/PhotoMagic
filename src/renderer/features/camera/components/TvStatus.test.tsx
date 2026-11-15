import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import type { DisplayState } from '@shared/ipc'
import { TvStatus } from './TvStatus'

const tv = { id: 2, primary: false, x: 1920, y: 0, width: 1080, height: 1920 }
const ready = (value: DisplayState) => ({ status: 'ready' as const, value })

describe('TvStatus (RF04)', () => {
  it('shows loading and read errors', () => {
    const { rerender } = render(<TvStatus view={{ status: 'loading' }} />)
    expect(screen.getByText('Procurando a TV…')).toBeInTheDocument()
    rerender(<TvStatus view={{ status: 'error' }} />)
    expect(screen.getByText('Não foi possível ler as telas conectadas')).toBeInTheDocument()
  })

  it('reports a portrait TV, a missing TV and a landscape TV', () => {
    const { rerender } = render(<TvStatus view={ready({ guest: { kind: 'portrait', display: tv }, tv: { kind: 'closed' } })} />)
    expect(screen.getByText('TV encontrada')).toBeInTheDocument()
    expect(screen.getByText('1080 × 1920, na vertical.')).toBeInTheDocument()
    rerender(<TvStatus view={ready({ guest: { kind: 'missing' }, tv: { kind: 'closed' } })} />)
    expect(screen.getByText('TV não encontrada')).toBeInTheDocument()
    rerender(<TvStatus view={ready({ guest: { kind: 'landscape-external', display: { ...tv, width: 1920, height: 1080 } }, tv: { kind: 'closed' } })} />)
    expect(screen.getByText('A TV não está na vertical')).toBeInTheDocument()
  })

  it('reports the open TV window and a TV unplugged mid-event', () => {
    const { rerender } = render(<TvStatus view={ready({ guest: { kind: 'portrait', display: tv }, tv: { kind: 'open', display: tv } })} />)
    expect(screen.getByText('Câmera aberta na TV')).toBeInTheDocument()
    rerender(<TvStatus view={ready({ guest: { kind: 'missing' }, tv: { kind: 'detached', reason: 'missing' } })} />)
    expect(screen.getByText('A TV foi desconectada')).toBeInTheDocument()
  })
})
