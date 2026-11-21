import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { eventState, stubBridge } from '@renderer/test/bridge'
import { PrintScreen } from './PrintScreen'

beforeEach(() => {
  vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:montage')
  vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {})
})

const review = (copies = 1) => eventState({ taken: 3, copies, phase: { kind: 'review' } })

describe('PrintScreen (RF10, RF13)', () => {
  it('shows the preview, 1 Cópia, Imprimir and Cancelar; Menos is disabled at 1', async () => {
    const { api } = stubBridge({ session: { getPreview: () => Promise.resolve({ revision: 1, jpeg: new Uint8Array([1]) }) } })
    render(<PrintScreen session={review()} />)
    expect(await screen.findByAltText('Prévia da montagem')).toBeInTheDocument()
    expect(screen.getByTestId('copies')).toHaveTextContent('1 Cópia')
    expect(screen.getByRole('button', { name: 'Menos' })).toBeDisabled()
    await userEvent.click(screen.getByRole('button', { name: 'Mais' }))
    expect(api.session.setCopies).toHaveBeenCalledWith(2)
    await userEvent.click(screen.getByRole('button', { name: 'Imprimir' }))
    expect(api.session.print).toHaveBeenCalled()
    await userEvent.click(screen.getByRole('button', { name: 'Cancelar' }))
    expect(api.session.cancel).toHaveBeenCalled()
  })

  it('disables Mais at 10', () => {
    stubBridge()
    render(<PrintScreen session={review(10)} />)
    expect(screen.getByTestId('copies')).toHaveTextContent('10 Cópias')
    expect(screen.getByRole('button', { name: 'Mais' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Menos' })).toBeEnabled()
  })

  it('offers Imprimir novamente and Nova rodada after a print', async () => {
    const { api } = stubBridge()
    render(<PrintScreen session={eventState({ taken: 3, phase: { kind: 'printed', fileName: '21-45-08.jpg' } })} />)
    await userEvent.click(screen.getByRole('button', { name: 'Imprimir novamente' }))
    expect(api.session.reprint).toHaveBeenCalled()
    await userEvent.click(screen.getByRole('button', { name: 'Nova rodada' }))
    expect(api.session.newRound).toHaveBeenCalled()
  })

  it('shows the printer state of a failure, keeps the round and offers to try again', () => {
    stubBridge()
    render(<PrintScreen session={eventState({ taken: 3, phase: { kind: 'print-failed', reason: 'no-paper', detail: '', fileName: '21-45-08.jpg' } })} />)
    expect(screen.getByText('Impressora sem papel')).toBeInTheDocument()
    expect(screen.getByText('A montagem 21-45-08.jpg ficou salva na pasta do evento.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Tentar novamente' })).toBeEnabled()
  })

  it('locks the controls while printing', () => {
    stubBridge()
    render(<PrintScreen session={eventState({ taken: 3, phase: { kind: 'printing', step: 'sending' } })} />)
    expect(screen.getByText('Imprimindo…')).toBeInTheDocument()
    for (const name of ['Imprimir', 'Cancelar', 'Mais', 'Menos']) expect(screen.getByRole('button', { name })).toBeDisabled()
  })

  it('follows the real job steps: the sheet stays inside while saving, then feeds out while sending', () => {
    stubBridge()
    const { rerender } = render(<PrintScreen session={eventState({ taken: 3, phase: { kind: 'printing', step: 'saving' } })} />)
    expect(screen.getByTestId('print-message')).toHaveTextContent('Preparando sua foto…')
    expect(screen.getByRole('progressbar', { name: 'Progresso da impressão' })).toHaveAttribute('aria-valuenow', '33')
    expect(screen.getByTestId('print-photo')).toHaveAttribute('data-eject', 'inside')
    rerender(<PrintScreen session={eventState({ taken: 3, phase: { kind: 'printing', step: 'sending' } })} />)
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '67')
    expect(screen.getByTestId('print-photo')).toHaveAttribute('data-eject', 'feeding')
    expect(screen.queryByText('Sua foto está pronta!')).toBeNull()
  })

  it('announces Sua foto está pronta! with a full bar only once printed', () => {
    stubBridge()
    render(<PrintScreen session={eventState({ taken: 3, phase: { kind: 'printed', fileName: '21-45-08.jpg' } })} />)
    expect(screen.getByTestId('print-message')).toHaveTextContent('Sua foto está pronta!')
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '100')
    expect(screen.getByTestId('print-photo')).toHaveAttribute('data-eject', 'out')
  })

  it('a failure drops the animation for the existing error screen', () => {
    stubBridge()
    render(<PrintScreen session={eventState({ taken: 3, phase: { kind: 'print-failed', reason: 'offline', detail: '', fileName: '21-45-08.jpg' } })} />)
    expect(screen.queryByRole('progressbar')).toBeNull()
    expect(screen.queryByText('Sua foto está pronta!')).toBeNull()
    expect(screen.getByText('Impressora desligada')).toBeInTheDocument()
  })

  it('warns on the TV when the printer is not ready, before Imprimir', async () => {
    stubBridge({ printer: { getStatus: () => Promise.resolve({ kind: 'no-paper' as const }) } })
    render(<PrintScreen session={review()} />)
    expect(await screen.findByTestId('tv-printer-status')).toHaveTextContent('Impressora sem papel')
  })

  it('shows no printer warning when it is ready', async () => {
    const { api } = stubBridge()
    render(<PrintScreen session={review()} />)
    await vi.waitFor(() => expect(api.printer.getStatus).toHaveBeenCalled())
    expect(screen.queryByTestId('tv-printer-status')).toBeNull()
  })
})
