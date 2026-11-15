import { expect, test } from './fixtures'
import { TV_TITLE, listWindows, openTv } from './tv'

// PRD scenarios whose screens do not exist yet. Each becomes a real test in the PR that builds its screen.
test.describe('create event', () => {
  test.fixme('RF01 accepts a 1844×1240 template for the selected mode and enables Iniciar evento', async () => {})
  test.fixme('RF01 shows the dimensions read for a template of another size and keeps Iniciar evento disabled', async () => {})
  test.fixme('RF01 keeps Iniciar evento disabled for an empty, reserved or invalid event name', async () => {})
  test.fixme('RF02 creates Desktop/<event name> on Iniciar evento', async () => {})
  test.fixme('RF02 reuses an existing event folder and keeps its files', async () => {})
})

// RF04. Until the create-event form exists (RF01), the laptop's TV card opens the TV; when
// `Iniciar evento` lands it takes over that click and these checks stay the same.
test.describe('create event: TV window (RF04)', () => {
  test('RF04 opens a frameless camera window on the portrait monitor', async ({ app, operatorWindow }) => {
    const card = operatorWindow.getByTestId('tv-card')
    await expect(card.getByTestId('tv-status')).toContainText('TV encontrada')
    await expect(card.getByTestId('tv-status')).toContainText('1080 × 1920, na vertical.')

    const tv = await openTv(app, operatorWindow)
    await expect(tv).toHaveTitle(TV_TITLE)
    await expect(card.getByTestId('tv-status')).toContainText('Câmera aberta na TV')

    const windows = await listWindows(app)
    expect(windows.find((window) => window.title === TV_TITLE)).toEqual({
      title: TV_TITLE,
      visible: true,
      bounds: { x: 1920, y: 0, width: 1080, height: 1920 },
    })
    // The laptop window stays on the primary (laptop) screen.
    const operator = windows.find((window) => window.title === 'Foto Mágica')
    expect(operator?.bounds.x).toBeLessThan(1920)

    await operatorWindow.getByRole('button', { name: 'Fechar tela da TV' }).click()
    await expect(card.getByTestId('tv-status')).toContainText('TV encontrada')
    await expect.poll(async () => (await listWindows(app)).map((window) => window.title)).toEqual(['Foto Mágica'])
  })

  test.describe('with only the laptop', () => {
    test.use({ appEnv: { FOTOMAGICA_DISPLAYS: 'laptop-only' } })

    test('RF04 explains that the TV was not found when there is only the laptop', async ({ app, operatorWindow }) => {
      await expect(operatorWindow.getByTestId('tv-status')).toContainText('TV não encontrada')
      await expect(operatorWindow.getByRole('button', { name: 'Abrir câmera na TV' })).toBeDisabled()
      expect(app.windows()).toHaveLength(1)
    })
  })

  test.describe('with a landscape TV', () => {
    test.use({ appEnv: { FOTOMAGICA_DISPLAYS: 'landscape-tv' } })

    test('RF04 warns about a landscape TV and opens after confirmation', async ({ app, operatorWindow }) => {
      await expect(operatorWindow.getByTestId('tv-status')).toContainText('A TV não está na vertical')
      expect(app.windows()).toHaveLength(1)

      await openTv(app, operatorWindow, 'Abrir mesmo assim')
      await expect(operatorWindow.getByTestId('tv-status')).toContainText('Câmera aberta na TV')
      const tvWindow = (await listWindows(app)).find((window) => window.title === TV_TITLE)
      expect(tvWindow?.bounds).toEqual({ x: 1920, y: 0, width: 1920, height: 1080 })
    })
  })
})
