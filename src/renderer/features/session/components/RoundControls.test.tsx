import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { eventState, stubBridge } from '@renderer/test/bridge'
import { RoundControls } from './RoundControls'

describe('RoundControls', () => {
  it('asks the TV for a photo and changes the shared timer and copies (RF06, RF07, RF10)', async () => {
    const { api } = stubBridge()
    render(<RoundControls session={eventState({ copies: 1 })} />)
    await userEvent.click(screen.getByRole('button', { name: 'Tirar foto' }))
    expect(api.session.requestShutter).toHaveBeenCalled()
    await userEvent.selectOptions(screen.getByLabelText('Timer'), '10 s')
    expect(api.session.setTimer).toHaveBeenCalledWith(10)
    expect(screen.getByRole('button', { name: 'Menos' })).toBeDisabled()
    await userEvent.click(screen.getByRole('button', { name: 'Mais' }))
    expect(api.session.setCopies).toHaveBeenCalledWith(2)
  })

  it('stops Mais at 10 and disables the shutter outside capturing', () => {
    stubBridge()
    render(<RoundControls session={eventState({ copies: 10, taken: 3, phase: { kind: 'review' } })} />)
    expect(screen.getByTestId('laptop-copies')).toHaveTextContent('10 Cópias')
    expect(screen.getByRole('button', { name: 'Mais' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Tirar foto' })).toBeDisabled()
  })

  it('shows a print failure in pt-BR', () => {
    stubBridge()
    render(<RoundControls session={eventState({ taken: 3, phase: { kind: 'print-failed', reason: 'cut-unavailable', detail: '', fileName: null } })} />)
    expect(screen.getByTestId('round-status')).toHaveTextContent('Não foi possível ajustar o corte da impressora')
  })

  it('shows the driver detail under a failure, on the laptop only', () => {
    stubBridge()
    render(<RoundControls session={eventState({ taken: 3, phase: { kind: 'print-failed', reason: 'unreported', detail: 'Win32Exception 0x6BA', fileName: '21-45-08.jpg' } })} />)
    expect(screen.getByTestId('round-status')).toHaveTextContent('Não foi possível imprimir. O driver não informou papel nem ribbon')
    expect(screen.getByTestId('round-status-detail')).toHaveTextContent('Detalhe técnico: Win32Exception 0x6BA')
  })
})
