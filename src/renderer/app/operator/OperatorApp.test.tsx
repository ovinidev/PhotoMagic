import { render, screen } from '@testing-library/react'
import { act } from 'react'
import { describe, expect, it } from 'vitest'
import { eventState, stubBridge } from '@renderer/test/bridge'
import { OperatorApp } from './OperatorApp'

describe('OperatorApp', () => {
  it('shows the create-event home with Iniciar evento disabled', async () => {
    stubBridge()
    render(<OperatorApp />)

    expect(screen.getByRole('heading', { name: 'Novo evento' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Iniciar evento' })).toBeDisabled()
    expect(await screen.findByText('Versão 0.1.0')).toBeInTheDocument()
  })

  it('shows the loading state, then an error when the bridge fails', async () => {
    stubBridge({ app: { getVersion: () => Promise.reject(new Error('ipc down')) } })
    render(<OperatorApp />)

    expect(screen.getByText('Carregando versão…')).toBeInTheDocument()
    expect(await screen.findByText('Não foi possível ler a versão do app')).toBeInTheDocument()
  })

  it('switches to the event screen when main opens an event, and back on Encerrar evento', async () => {
    const { pushSession, api } = stubBridge()
    render(<OperatorApp />)
    expect(screen.getByRole('heading', { name: 'Novo evento' })).toBeInTheDocument()

    act(() => pushSession(eventState({ taken: 1 })))
    expect(await screen.findByTestId('event-title')).toHaveTextContent('Aniversário AJ')
    expect(screen.getByTestId('round-status')).toHaveTextContent('Foto 2/3')
    expect(screen.getByRole('button', { name: 'Tirar foto' })).toBeEnabled()

    screen.getByRole('button', { name: 'Encerrar evento' }).click()
    expect(api.event.end).toHaveBeenCalled()
    act(() => pushSession({ kind: 'idle' }))
    expect(await screen.findByRole('heading', { name: 'Novo evento' })).toBeInTheDocument()
  })
})
