import type { ElectronApplication } from '@playwright/test'
import { expect, test } from './fixtures'
import { startEvent } from './event'
import { TV_TITLE } from './tv'

/** The zoom factor Electron applies to each window, by title. */
function zoomFactors(app: ElectronApplication): Promise<Record<string, number>> {
  return app.evaluate(({ BrowserWindow }) =>
    Object.fromEntries(BrowserWindow.getAllWindows().map((window) => [window.getTitle(), window.webContents.getZoomFactor()])),
  )
}

test.describe('laptop zoom (DESIGN §3)', () => {
  test('grows with the window, steps with Ctrl + and is saved on this computer', async ({ app, operatorWindow, relaunch }) => {
    await expect(operatorWindow.getByTestId('app-version')).toContainText('Versão')
    await expect(operatorWindow.getByRole('button', { name: /zoom/i })).toHaveCount(0)
    // The E2E window is 1280×800: the reference size, so the automatic factor is 1.
    await expect.poll(async () => (await zoomFactors(app))['Foto Mágica']).toBe(1)

    // A maximized-1080p-sized window grows the UI by itself.
    await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0]!.setContentSize(1920, 1017))
    await expect.poll(async () => (await zoomFactors(app))['Foto Mágica']).toBeCloseTo(1.34, 2)

    await operatorWindow.keyboard.press('Control+=')
    await expect.poll(async () => (await zoomFactors(app))['Foto Mágica']).toBeCloseTo(1.47, 2)
    await operatorWindow.keyboard.press('Control+=')
    await expect.poll(async () => (await zoomFactors(app))['Foto Mágica']).toBeCloseTo(1.67, 1)

    const next = await relaunch()
    await expect.poll(async () => (await zoomFactors(next.app))['Foto Mágica']).toBeCloseTo(1.25, 2)
    await expect(next.operatorWindow.getByTestId('app-version')).toContainText('Versão')
    await next.operatorWindow.keyboard.press('Control+0')
    await expect.poll(async () => (await zoomFactors(next.app))['Foto Mágica']).toBe(1)
  })

  test('never zooms the TV window', async ({ app, operatorWindow }) => {
    await expect(operatorWindow.getByTestId('app-version')).toContainText('Versão')
    await operatorWindow.keyboard.press('Control+=')
    await expect.poll(async () => (await zoomFactors(app))['Foto Mágica']).toBeCloseTo(1.1, 2)
    await operatorWindow.keyboard.press('Control+=')
    await expect.poll(async () => (await zoomFactors(app))['Foto Mágica']).toBeCloseTo(1.25, 2)
    const tv = await startEvent(app, operatorWindow, { name: 'Festa', template: null })
    const factors = await zoomFactors(app)
    expect(factors['Foto Mágica']).toBeCloseTo(1.25, 2)
    expect(factors[TV_TITLE]).toBe(1)
    // The TV page lays out at its own 1:1 size.
    expect(await tv.evaluate(() => window.devicePixelRatio)).toBe(1)
    // A Ctrl + wheel over the TV changes nothing.
    await tv.mouse.move(100, 100)
    await tv.keyboard.down('Control')
    await tv.mouse.wheel(0, -300)
    await tv.keyboard.up('Control')
    expect((await zoomFactors(app))[TV_TITLE]).toBe(1)
  })
})
