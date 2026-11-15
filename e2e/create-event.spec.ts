import { existsSync, mkdirSync, readdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { expect, test } from './fixtures'
import { TV_TITLE, listWindows, tvPlacement } from './tv'
import { fillEvent, startEvent, validTemplate, writePng } from './event'

test.describe('create event (RF01, RF02)', () => {
  test('RF01 accepts a 1844×1240 template for the selected mode and enables Iniciar evento', async ({ operatorWindow }) => {
    await fillEvent(operatorWindow, { name: 'Aniversário AJ', mode: 'two-strips' })
    await expect(operatorWindow.getByAltText('Template do modo 2 tiras')).toBeVisible()
    await expect(operatorWindow.getByRole('button', { name: 'Iniciar evento' })).toBeEnabled()

    // The other mode keeps its own (empty) template.
    await operatorWindow.getByRole('radio', { name: /1 tira/ }).check()
    await expect(operatorWindow.getByText(/Nenhum template para 1 tira/)).toBeVisible()
    await expect(operatorWindow.getByRole('button', { name: 'Iniciar evento' })).toBeDisabled()
  })

  test('RF01 shows the dimensions read for a template of another size and keeps Iniciar evento disabled', async ({ operatorWindow, dirs }) => {
    const wrong = await writePng('wrong-1200x1800.png', { width: 1200, height: 1800 })
    await fillEvent(operatorWindow, { name: 'Festa', template: wrong })
    await expect(operatorWindow.getByText('O arquivo tem 1200 × 1800 px. O template precisa ter 1844 × 1240 px.')).toBeVisible()
    await expect(operatorWindow.getByRole('button', { name: 'Iniciar evento' })).toBeDisabled()
    expect(existsSync(join(dirs.desktop, 'Festa'))).toBe(false)
  })

  test('RF01 keeps Iniciar evento disabled for an empty, reserved or invalid event name', async ({ operatorWindow }) => {
    await fillEvent(operatorWindow, { name: 'Festa' })
    const start = operatorWindow.getByRole('button', { name: 'Iniciar evento' })
    await expect(start).toBeEnabled()
    for (const name of ['', '   ', 'CON', 'lpt1', 'Festa: 15', 'a/b', 'Festa.']) {
      await operatorWindow.getByLabel('Nome do evento').fill(name)
      await expect(start, name).toBeDisabled()
    }
  })

  test('RF02 creates Desktop/<event name> on Iniciar evento', async ({ app, operatorWindow, dirs }) => {
    await startEvent(app, operatorWindow, { name: 'Aniversário AJ' })
    await expect(operatorWindow.getByTestId('event-title')).toContainText('Aniversário AJ')
    expect(readdirSync(join(dirs.desktop, 'Aniversário AJ'))).toEqual([])
  })

  test('RF02 reuses an existing event folder and keeps its files', async ({ app, operatorWindow, dirs }) => {
    const folder = join(dirs.desktop, 'Aniversário AJ')
    mkdirSync(folder, { recursive: true })
    writeFileSync(join(folder, '21-45-08.jpg'), 'previous montage')
    await startEvent(app, operatorWindow, { name: 'Aniversário AJ' })
    expect(readdirSync(folder)).toEqual(['21-45-08.jpg'])
  })

  test('RF01 keeps each mode template across a restart, outside the event folder', async ({ operatorWindow, dirs }) => {
    await fillEvent(operatorWindow, { name: 'Festa', template: await validTemplate() })
    await expect(operatorWindow.getByTestId('template-file-name')).toContainText('template-1844x1240.png')
    expect(readdirSync(join(dirs.userData, 'templates'))).toEqual(['two-strips.png'])
    await operatorWindow.reload()
    await expect(operatorWindow.getByTestId('template-file-name')).toContainText('template-1844x1240.png')
  })
})

test.describe('create event: TV window (RF04)', () => {
  test('RF04 opens a frameless camera window on the portrait monitor', async ({ app, operatorWindow }) => {
    await expect(operatorWindow.getByTestId('tv-status')).toContainText('1080 × 1920, na vertical.')
    const tv = await startEvent(app, operatorWindow, { name: 'Festa' })
    await expect(tv).toHaveTitle(TV_TITLE)
    await expect(operatorWindow.getByTestId('tv-status')).toContainText('Câmera aberta na TV')

    expect(await tvPlacement(operatorWindow)).toEqual({ kind: 'open', bounds: { x: 1920, y: 0, width: 1080, height: 1920 } })
    const windows = await listWindows(app)
    expect(windows.find((window) => window.title === TV_TITLE)?.visible).toBe(true)
    // The laptop window stays on the primary (laptop) screen.
    expect(windows.find((window) => window.title === 'Foto Mágica')?.bounds.x).toBeLessThan(1920)
  })

  test.describe('with only the laptop', () => {
    test.use({ appEnv: { FOTOMAGICA_DISPLAYS: 'laptop-only' } })

    test('RF04 explains that the TV was not found when there is only the laptop', async ({ app, operatorWindow, dirs }) => {
      await fillEvent(operatorWindow, { name: 'Festa' })
      await expect(operatorWindow.getByTestId('tv-status')).toContainText('TV não encontrada')
      await expect(operatorWindow.getByRole('button', { name: 'Iniciar evento' })).toBeDisabled()
      expect(app.windows()).toHaveLength(1)
      expect(existsSync(join(dirs.desktop, 'Festa'))).toBe(false)
    })
  })

  test.describe('with a landscape TV', () => {
    test.use({ appEnv: { FOTOMAGICA_DISPLAYS: 'landscape-tv' } })

    test('RF04 warns about a landscape TV and opens after confirmation', async ({ app, operatorWindow }) => {
      await fillEvent(operatorWindow, { name: 'Festa' })
      await expect(operatorWindow.getByTestId('tv-status')).toContainText('A TV não está na vertical')
      await expect(operatorWindow.getByRole('button', { name: 'Iniciar evento' })).toBeDisabled()
      expect(app.windows()).toHaveLength(1)

      await operatorWindow.getByRole('checkbox', { name: 'Abrir a câmera na TV mesmo na horizontal' }).check()
      const opened = app.waitForEvent('window')
      await operatorWindow.getByRole('button', { name: 'Iniciar evento' }).click()
      await opened
      await expect(operatorWindow.getByTestId('tv-status')).toContainText('Câmera aberta na TV')
      expect(await tvPlacement(operatorWindow)).toEqual({ kind: 'open', bounds: { x: 1920, y: 0, width: 1920, height: 1080 } })
    })
  })
})
