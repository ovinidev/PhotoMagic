import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { expect, test } from './fixtures'

const { version } = JSON.parse(readFileSync(resolve(__dirname, '../package.json'), 'utf8')) as { version: string }

test.describe('app shell', () => {
  test('opens the operator window with the pt-BR home screen', async ({ app, operatorWindow }) => {
    await expect(operatorWindow).toHaveTitle('Foto Mágica')
    await expect(operatorWindow.getByRole('heading', { name: 'Novo evento' })).toBeVisible()
    await expect(operatorWindow.getByRole('button', { name: 'Iniciar evento' })).toBeDisabled()
    await expect(operatorWindow.getByTestId('app-version')).toHaveText(`Versão ${version}`)

    expect(app.windows()).toHaveLength(1)
  })

  test('runs with a hardened renderer and the E2E flags', async ({ operatorWindow }) => {
    const exposure = await operatorWindow.evaluate(() => ({
      bridge: typeof window.fotomagica?.app?.getVersion,
      require: typeof (window as unknown as { require?: unknown }).require,
      process: typeof (window as unknown as { process?: unknown }).process,
    }))
    expect(exposure).toEqual({ bridge: 'function', require: 'undefined', process: 'undefined' })

    const reported = await operatorWindow.evaluate(() => window.fotomagica.app.getVersion())
    expect(reported).toEqual({ version, e2e: true })
  })
})
