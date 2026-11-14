import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import type { FotomagicaApi } from '@shared/ipc'
import { OperatorApp } from './OperatorApp'

function stubBridge(getVersion: FotomagicaApi['app']['getVersion']) {
  window.fotomagica = { app: { getVersion } }
}

describe('OperatorApp', () => {
  it('shows the create-event home with Iniciar evento disabled', async () => {
    stubBridge(() => Promise.resolve({ version: '0.1.0', e2e: false }))
    render(<OperatorApp />)

    expect(screen.getByRole('heading', { name: 'Novo evento' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Iniciar evento' })).toBeDisabled()
    expect(await screen.findByText('Versão 0.1.0')).toBeInTheDocument()
  })

  it('shows the loading state, then an error when the bridge fails', async () => {
    stubBridge(() => Promise.reject(new Error('ipc down')))
    render(<OperatorApp />)

    expect(screen.getByText('Carregando versão…')).toBeInTheDocument()
    expect(await screen.findByText('Não foi possível ler a versão do app')).toBeInTheDocument()
  })
})
