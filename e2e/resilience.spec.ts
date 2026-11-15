import { readdirSync } from 'node:fs'
import { join } from 'node:path'
import { expect, test } from './fixtures'
import { TV_TITLE, listWindows, setDisplays, tvPlacement } from './tv'
import { fillEvent, startEvent, takePhotos } from './event'

// Each capture is a full-resolution 4K JPEG encoded in software under xvfb (see PHOTO_TIMEOUT).
test.describe.configure({ timeout: 90_000 })

test.describe('resilience', () => {
  // Chromium's fake camera cannot be unplugged mid-run; this needs a test hook that ends the track.
  test.fixme('RNF10 keeps the photos and accepts touch when the webcam disappears mid-round', async () => {})
  test.fixme('RF15 webcam panel opens with persisted controls in fixture mode', async () => {})

  test('RF16 Encerrar evento closes the TV, forgets the round and returns to the home screen', async ({ app, operatorWindow, dirs }) => {
    const tv = await startEvent(app, operatorWindow, { name: 'Festa' })
    await takePhotos(tv, 2)
    await operatorWindow.getByRole('button', { name: 'Encerrar evento' }).click()
    await expect(operatorWindow.getByRole('heading', { name: 'Novo evento' })).toBeVisible()
    await expect.poll(async () => (await listWindows(app)).map((window) => window.title)).toEqual(['Foto Mágica'])
    // The folder stays; the unprinted round wrote nothing.
    expect(readdirSync(join(dirs.desktop, 'Festa'))).toEqual([])
    expect(await operatorWindow.evaluate(() => window.fotomagica.session.getState())).toEqual({ kind: 'idle' })
  })
})

test.describe('resilience: TV monitor and camera', () => {
  test('hides the TV window when the TV is unplugged, keeps the round, and brings it back on replug', async ({ app, operatorWindow }) => {
    const tv = await startEvent(app, operatorWindow, { name: 'Festa' })
    await takePhotos(tv, 1)
    const status = operatorWindow.getByTestId('tv-status')
    const tvWindow = async () => (await listWindows(app)).find((window) => window.title === TV_TITLE)

    await setDisplays(app, 'laptop-only')
    await expect(status).toContainText('A TV foi desconectada')
    // Hidden, not moved onto the laptop and not destroyed: the camera and the round stay in memory.
    await expect.poll(async () => (await tvWindow())?.visible).toBe(false)
    expect(await tvPlacement(operatorWindow)).toEqual({ kind: 'detached', reason: 'missing' })
    await expect(operatorWindow.getByTestId('round-status')).toHaveText('Foto 2/3')

    await setDisplays(app, 'portrait-tv')
    await expect(status).toContainText('Câmera aberta na TV')
    await expect.poll(async () => (await tvWindow())?.visible).toBe(true)
    expect(await tvPlacement(operatorWindow)).toEqual({ kind: 'open', bounds: { x: 1920, y: 0, width: 1080, height: 1920 } })
    await expect(tv.getByTestId('photo-counter')).toHaveText('2/3')
  })

  test.describe('without any camera', () => {
    test.use({ appEnv: { FOTOMAGICA_FAKE_CAMERA: 'none' } })

    test('the TV explains the missing camera, keeps responding, and the laptop shows it', async ({ app, operatorWindow }) => {
      await fillEvent(operatorWindow, { name: 'Festa' })
      const opened = app.waitForEvent('window')
      await operatorWindow.getByRole('button', { name: 'Iniciar evento' }).click()
      const tv = await opened
      await expect(tv.getByText('Nenhuma câmera encontrada')).toBeVisible()
      await expect(operatorWindow.getByTestId('camera-status')).toContainText('Nenhuma câmera encontrada')
      await expect(tv.getByRole('button', { name: 'Tirar foto' })).toBeDisabled()

      // The TV still accepts touch: retrying goes through the loading state and back to the error.
      await tv.getByRole('button', { name: 'Tentar novamente' }).click()
      await expect(tv.getByTestId('camera-view')).toHaveAttribute('data-camera-state', 'error')
    })
  })
})
