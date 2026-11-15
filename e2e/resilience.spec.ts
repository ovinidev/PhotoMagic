import { mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { expect, test } from './fixtures'
import { TV_TITLE, listWindows, setDisplays, tvPlacement } from './tv'
import { PHOTO_TIMEOUT, fillEvent, startEvent, takePhotos } from './event'

test.describe('resilience', () => {
  test('RNF10 keeps the photos and accepts touch when the webcam disappears mid-round', async ({ app, operatorWindow }) => {
    const tv = await startEvent(app, operatorWindow, { name: 'Festa' })
    await takePhotos(tv, 2)
    // Chromium's fake camera cannot be unplugged: end its track the way an unplug does.
    await tv.evaluate(() => {
      const video = document.querySelector('video')
      const track = (video?.srcObject as MediaStream | null)?.getVideoTracks()[0]
      if (!track) throw new Error('no live track')
      track.stop()
      track.dispatchEvent(new Event('ended'))
    })
    await expect(tv.getByText('A câmera foi desconectada')).toBeVisible()
    await expect(operatorWindow.getByTestId('camera-status')).toContainText('A câmera foi desconectada')
    // The two photos stay in the round and the TV keeps answering touch.
    await expect(tv.getByTestId('photo-counter')).toHaveText('3/3')
    await expect(operatorWindow.getByTestId('round-status')).toHaveText('Foto 3/3')
    await expect(tv.getByRole('button', { name: 'Tirar foto' })).toBeDisabled()
    await tv.getByRole('radio', { name: '5 s' }).click()
    await expect(operatorWindow.getByLabel('Timer')).toHaveValue('5')
    await tv.getByRole('radio', { name: 'Sem timer' }).click()

    // Plugging the camera back (a devicechange) reopens it, and the missing photo can be taken.
    await tv.evaluate(() => navigator.mediaDevices.dispatchEvent(new Event('devicechange')))
    await expect(tv.getByTestId('camera-view')).toHaveAttribute('data-camera-state', 'live')
    await tv.getByRole('button', { name: 'Tirar foto' }).click()
    await expect(tv.getByTestId('print-screen')).toBeVisible({ timeout: PHOTO_TIMEOUT })
  })

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

    test('RF15 webcam panel opens with persisted controls in fixture mode', async ({ dirs, relaunch }) => {
      // Values and the controls a real camera advertised, saved by an earlier run.
      const capabilities = {
        controls: { brightness: { key: 'brightness', min: 0, max: 255, step: 1 }, contrast: { key: 'contrast', min: 0, max: 255, step: 1 } },
        whiteBalanceModes: [],
        powerLineFrequency: false,
      }
      mkdirSync(dirs.userData, { recursive: true })
      writeFileSync(join(dirs.userData, 'config.json'), JSON.stringify({ webcam: { values: { controls: { brightness: 90 } }, capabilities } }))
      let { app, operatorWindow } = await relaunch()

      await fillEvent(operatorWindow, { name: 'Festa' })
      const opened = app.waitForEvent('window')
      await operatorWindow.getByRole('button', { name: 'Iniciar evento' }).click()
      const tv = await opened
      await expect(tv.getByText('Nenhuma câmera encontrada')).toBeVisible()

      const laptop = operatorWindow.getByTestId('webcam-panel-laptop')
      await expect(laptop.getByLabel('Brilho')).toHaveValue('90')
      await expect(laptop.getByLabel('Contraste')).toBeVisible()
      await expect(laptop.getByText(/A câmera não está aberta/)).toBeVisible()
      await expect(laptop.getByLabel('Nitidez')).toHaveCount(0)

      // The same panel on the TV, from the adjustments icon.
      await tv.getByRole('button', { name: 'Ajustes da webcam' }).click()
      await expect(tv.getByTestId('webcam-panel-tv').getByLabel('Brilho')).toHaveValue('90')

      // A change on the laptop reaches the TV panel and survives a restart.
      await laptop.getByLabel('Brilho').fill('150')
      await expect(tv.getByTestId('webcam-panel-tv').getByLabel('Brilho')).toHaveValue('150')
      await expect.poll(() => JSON.parse(readFileSync(join(dirs.userData, 'config.json'), 'utf8')).webcam.values.controls.brightness).toBe(150)
      ;({ app, operatorWindow } = await relaunch())
      expect(await operatorWindow.evaluate(() => window.fotomagica.webcam.getState())).toMatchObject({ values: { controls: { brightness: 150 } }, live: false })
    })

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
