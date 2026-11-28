import { expect, test } from './fixtures'
import { PRINT_TIMEOUT, simulatedTickets, startEvent, takePhotos } from './event'

test.describe('printer screen (DESIGN §10)', () => {
  test('reads the saved Windows preferences, and the cut per mode and the restore choice reach the next print', async ({ app, operatorWindow, dirs }) => {
    const card = operatorWindow.getByTestId('printer-settings')
    await expect(card.getByTestId('printer-settings-status')).toContainText('Corte de 2": ligado em 2 tiras, desligado em 1 tira')
    await card.getByRole('button', { name: 'Configurar' }).click()
    const panel = operatorWindow.getByRole('dialog', { name: 'Impressora' })
    await expect(panel.getByTestId('printer-report-queue')).toHaveText('DS-RX1 (simulada)')
    await expect(panel.getByTestId('printer-report-paper')).toHaveText('(6x4)')
    await expect(panel.getByTestId('printer-report-cut')).toHaveText('Disable')

    // Keep the cut in Windows after the print, and turn the 2 tiras cut off.
    await panel.getByTestId('printer-restore').uncheck()
    await panel.getByTestId('printer-cut-two-strips').uncheck()
    await expect(panel.getByTestId('printer-settings-notice')).toHaveText('Salvo. Vale a partir da próxima impressão.')
    await panel.getByRole('button', { name: 'Fechar' }).click()
    await expect(card.getByTestId('printer-settings-status')).toContainText('desligado em 2 tiras')

    const tv = await startEvent(app, operatorWindow, { name: 'Festa', template: null })
    await takePhotos(tv, 3)
    await tv.getByRole('button', { name: 'Imprimir' }).click()
    await expect(tv.getByTestId('print-screen')).toHaveAttribute('data-phase', 'printed', { timeout: PRINT_TIMEOUT })
    const [ticket] = await simulatedTickets(dirs.userData)
    expect(ticket).toMatchObject({ mode: 'two-strips', cut: false, restorePreferences: false })

    // Restore was off, so Windows keeps what that print set: the cut it asked for (off).
    await operatorWindow.getByRole('button', { name: 'Encerrar evento' }).click()
    await operatorWindow.getByTestId('printer-settings').getByRole('button', { name: 'Configurar' }).click()
    await expect(operatorWindow.getByTestId('printer-report-cut')).toHaveText('Disable')
  })
})
