import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { stubBridge } from '@renderer/test/bridge'
import { PrinterSettingsCard } from './PrinterSettingsCard'

describe('PrinterSettingsCard (printer screen)', () => {
  it('shows the state and the cut per mode in one row', async () => {
    stubBridge()
    render(<PrinterSettingsCard />)
    expect(await screen.findByTestId('printer-settings-status')).toHaveTextContent('Corte de 2": ligado em 2 tiras, desligado em 1 tira')
    await waitFor(() => expect(screen.getByTestId('printer-settings-status')).toHaveTextContent('Impressora pronta'))
  })

  it('opening Configurar reads the printer once and shows its saved Windows preferences, changing nothing', async () => {
    const { api } = stubBridge()
    render(<PrinterSettingsCard />)
    await userEvent.click(await screen.findByRole('button', { name: 'Configurar' }))
    const panel = screen.getByRole('dialog', { name: 'Impressora' })
    expect(await within(panel).findByTestId('printer-report-queue')).toHaveTextContent('DS-RX1')
    expect(within(panel).getByTestId('printer-report-paper')).toHaveTextContent('(6x4)')
    expect(within(panel).getByTestId('printer-report-orientation')).toHaveTextContent('Retrato')
    expect(within(panel).getByTestId('printer-report-cut')).toHaveTextContent('Disable')
    expect(api.printer.inspect).toHaveBeenCalledTimes(1)
    await userEvent.click(within(panel).getByRole('button', { name: 'Ler impressora' }))
    await waitFor(() => expect(api.printer.inspect).toHaveBeenCalledTimes(2))
    expect(api.printer.saveSettings).not.toHaveBeenCalled()
  })

  it('saves the cut per mode and the restore choice as soon as they change', async () => {
    const { api } = stubBridge()
    render(<PrinterSettingsCard />)
    await userEvent.click(await screen.findByRole('button', { name: 'Configurar' }))
    await userEvent.click(screen.getByTestId('printer-cut-two-strips'))
    expect(api.printer.saveSettings).toHaveBeenLastCalledWith({ cut: { 'two-strips': false, 'one-strip': false }, restorePreferences: true })
    await userEvent.click(screen.getByTestId('printer-restore'))
    expect(api.printer.saveSettings).toHaveBeenLastCalledWith({ cut: { 'two-strips': false, 'one-strip': false }, restorePreferences: false })
    expect(await screen.findByTestId('printer-settings-notice')).toHaveTextContent('Salvo. Vale a partir da próxima impressão.')
  })

  it('reports a printer that could not be read', async () => {
    stubBridge({ printer: { inspect: () => Promise.resolve({ queue: null, preferences: null, detail: 'Nenhuma impressora com DS-RX1 no nome.' }) } })
    render(<PrinterSettingsCard />)
    await userEvent.click(await screen.findByRole('button', { name: 'Configurar' }))
    expect(await screen.findByTestId('printer-report-queue')).toHaveTextContent('Nenhuma DS-RX1 encontrada')
    expect(screen.getByText(/Detalhe técnico: Nenhuma impressora/)).toBeInTheDocument()
  })
})
