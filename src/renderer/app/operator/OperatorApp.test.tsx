import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { act } from 'react'
import { describe, expect, it } from 'vitest'
import { eventState, stubBridge } from '@renderer/test/bridge'
import { OperatorApp } from './OperatorApp'

describe('OperatorApp', () => {
  it('shows the create-event home with Iniciar evento disabled', async () => {
    stubBridge()
    render(<OperatorApp />)

    // RNF12: the full logo at startup, until main answers whether an event is open.
    expect(screen.getByTestId('startup-splash')).toBeInTheDocument()
    expect(await screen.findByRole('heading', { name: 'Novo evento' })).toBeInTheDocument()
    expect(screen.queryByTestId('startup-splash')).toBeNull()
    expect(screen.getByRole('button', { name: 'Iniciar evento' })).toBeDisabled()
    expect(await screen.findByText('Versão 0.1.0')).toBeInTheDocument()
  })

  it('shows the loading state, then an error when the bridge fails', async () => {
    stubBridge({ app: { getVersion: () => Promise.reject(new Error('ipc down')) } })
    render(<OperatorApp />)

    expect(screen.getByText('Carregando versão…')).toBeInTheDocument()
    expect(await screen.findByText('Não foi possível ler a versão do app')).toBeInTheDocument()
  })

  it('shows a discreet update line only while an update downloads or waits for quit', async () => {
    const { pushUpdate } = stubBridge()
    render(<OperatorApp />)
    expect(await screen.findByText('Versão 0.1.0')).toBeInTheDocument()
    expect(screen.queryByTestId('update-status')).toBeNull()

    act(() => pushUpdate({ kind: 'downloading', version: '0.2.0', percent: 42 }))
    expect(screen.getByTestId('update-status')).toHaveTextContent('Baixando atualização 0.2.0 (42%)')

    act(() => pushUpdate({ kind: 'ready', version: '0.2.0' }))
    expect(screen.getByTestId('update-status')).toHaveTextContent('Atualização 0.2.0 pronta: será instalada ao fechar o app')

    act(() => pushUpdate({ kind: 'idle' }))
    expect(screen.queryByTestId('update-status')).toBeNull()
  })

  it('switches to the event screen when main opens an event, and back on Encerrar evento', async () => {
    const { pushSession, api } = stubBridge()
    render(<OperatorApp />)
    expect(await screen.findByRole('heading', { name: 'Novo evento' })).toBeInTheDocument()

    act(() => pushSession(eventState({ taken: 1 })))
    expect(await screen.findByTestId('event-title')).toHaveTextContent('Aniversário AJ')
    expect(screen.getByTestId('round-status')).toHaveTextContent('Foto 2/3')
    expect(screen.getByRole('button', { name: 'Tirar foto' })).toBeEnabled()

    screen.getByRole('button', { name: 'Encerrar evento' }).click()
    expect(api.event.end).toHaveBeenCalled()
    act(() => pushSession({ kind: 'idle' }))
    expect(await screen.findByRole('heading', { name: 'Novo evento' })).toBeInTheDocument()
  })

  it('opens the slot editor over the form and closes it with Concluir, keeping the typed name', async () => {
    stubBridge()
    render(<OperatorApp />)
    await userEvent.type(await screen.findByLabelText('Nome do evento'), 'Festa')
    await userEvent.click(screen.getByRole('button', { name: 'Editar posições das fotos (2 tiras)' }))
    const dialog = await screen.findByRole('dialog', { name: 'Posições das fotos' })
    expect(await within(dialog).findAllByRole('button', { name: /^(Cima|Baixo) \d, foto \d$/ })).toHaveLength(5)
    await userEvent.click(within(dialog).getByRole('button', { name: 'Concluir' }))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(screen.getByLabelText('Nome do evento')).toHaveValue('Festa')
  })
})
