import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { stubBridge } from '@renderer/test/bridge'
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
})
