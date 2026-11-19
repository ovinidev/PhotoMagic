import type { Page } from '@playwright/test'
import { expect } from './fixtures'

/** A port away from the default, so a dev instance on 8787 never collides with a test. */
export const E2E_SHARE_PORT = 18787

/**
 * Turns on the offline photo download from the laptop card (DESIGN §17), bound to loopback so the
 * test can fetch the link: CI machines have no hotspot.
 */
export async function enableShare(operatorWindow: Page, options: { ssid?: string; password?: string } = {}): Promise<void> {
  const card = operatorWindow.getByTestId('share-settings')
  await card.getByLabel('Mostrar QR code para baixar a foto').check()
  await card.getByLabel('Nome do Wi-Fi (SSID)').fill(options.ssid ?? 'FotoMagica')
  await card.getByLabel('Senha do Wi-Fi').fill(options.password ?? 'festa2026')
  await card.getByLabel('Endereço do notebook').fill('127.0.0.1')
  await card.getByLabel('Porta').fill(String(E2E_SHARE_PORT))
  await card.getByRole('button', { name: 'Salvar' }).click()
  await expect(card.getByTestId('share-status')).toContainText(`Ativo em http://127.0.0.1:${E2E_SHARE_PORT}`)
}
