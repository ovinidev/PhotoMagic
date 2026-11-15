import { expect, test } from './fixtures'
import { TV_TITLE, listWindows, openTv, setDisplays, tvPlacement } from './tv'

// PRD scenarios whose screens do not exist yet. Each becomes a real test in the PR that builds its screen.
test.describe('resilience', () => {
  test.fixme('RNF10 keeps the photos and accepts touch when the webcam disappears mid-round', async () => {})
  test.fixme('RF16 Encerrar evento closes the TV and returns to the home screen', async () => {})
  test.fixme('RF15 webcam panel opens with persisted controls in fixture mode', async () => {})
})

test.describe('resilience: TV monitor and camera', () => {
  test('hides the TV window when the TV is unplugged and brings it back on replug', async ({ app, operatorWindow }) => {
    const tv = await openTv(app, operatorWindow)
    const status = operatorWindow.getByTestId('tv-status')
    const tvWindow = async () => (await listWindows(app)).find((window) => window.title === TV_TITLE)

    await setDisplays(app, 'laptop-only')
    await expect(status).toContainText('A TV foi desconectada')
    // Hidden, not moved onto the laptop and not destroyed: the camera and the round stay in memory.
    await expect.poll(async () => (await tvWindow())?.visible).toBe(false)
    expect(await tvPlacement(operatorWindow)).toEqual({ kind: 'detached', reason: 'missing' })

    await setDisplays(app, 'portrait-tv')
    await expect(status).toContainText('Câmera aberta na TV')
    await expect.poll(async () => (await tvWindow())?.visible).toBe(true)
    expect(await tvPlacement(operatorWindow)).toEqual({ kind: 'open', bounds: { x: 1920, y: 0, width: 1080, height: 1920 } })
    await expect(tv.getByTestId('camera-view')).toBeVisible()
  })

  test.describe('without any camera', () => {
    test.use({ appEnv: { FOTOMAGICA_FAKE_CAMERA: 'none' } })

    test('the TV explains the missing camera, keeps responding, and the laptop shows it', async ({ app, operatorWindow }) => {
      const tv = await openTv(app, operatorWindow)
      await expect(tv.getByText('Nenhuma câmera encontrada')).toBeVisible()
      await expect(operatorWindow.getByTestId('camera-status')).toContainText('Nenhuma câmera encontrada')

      // The TV still accepts touch: retrying goes through the loading state and back to the error.
      await tv.getByRole('button', { name: 'Tentar novamente' }).click()
      await expect(tv.getByTestId('camera-view')).toHaveAttribute('data-camera-state', 'error')
    })
  })
})
