import { copyFileSync, mkdirSync, readdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import sharp from 'sharp'
import { expect, test, type AppDirs } from './fixtures'
import { PRINT_TIMEOUT, simulatedTickets, startEvent, takePhotos } from './event'

/** An event folder that already holds two montages and files the app did not write (RF02 reuse). */
async function seedFolder(dirs: AppDirs): Promise<string> {
  const folder = join(dirs.desktop, 'Festa')
  mkdirSync(folder, { recursive: true })
  const jpeg = (color: string) => sharp({ create: { width: 1844, height: 1240, channels: 3, background: color } }).jpeg().toBuffer()
  writeFileSync(join(folder, '20-00-00.jpg'), await jpeg('#335577'))
  writeFileSync(join(folder, '20-05-00.jpg'), await jpeg('#775533'))
  writeFileSync(join(folder, 'foto.png'), 'not a montage')
  writeFileSync(join(folder, 'IMG_0001.jpg'), 'not a montage')
  return folder
}

test.describe('gallery', () => {
  test('RF14 lists only the app montages in the event folder', async ({ app, operatorWindow, dirs }) => {
    await seedFolder(dirs)
    const tv = await startEvent(app, operatorWindow, { name: 'Festa' })

    const laptop = operatorWindow.getByTestId('laptop-gallery')
    await expect(laptop.getByRole('button', { name: /Abrir a montagem/ })).toHaveCount(2)
    await expect(laptop.getByRole('button', { name: 'Abrir a montagem 20-00-00.jpg' })).toBeVisible()
    await expect(laptop.getByText('foto.png')).toHaveCount(0)
    await expect(laptop.getByText('IMG_0001.jpg')).toHaveCount(0)

    // The TV thumbnail opens the same list.
    await expect(tv.getByTestId('tv-gallery-thumb').getByTestId('gallery-thumb')).toBeVisible()
    await tv.getByRole('button', { name: 'Abrir a galeria' }).click()
    const tvGallery = tv.getByRole('dialog', { name: 'Galeria' })
    await expect(tvGallery.getByRole('button', { name: /Abrir a montagem/ })).toHaveCount(2)

    // A new print shows up on both, newest first, and the round goes back to the camera (RF13).
    await tvGallery.getByRole('button', { name: 'Fechar' }).click()
    await takePhotos(tv, 3)
    await tv.getByRole('button', { name: 'Imprimir' }).click()
    await expect(tv.getByTestId('print-screen')).toHaveAttribute('data-phase', 'printed', { timeout: PRINT_TIMEOUT })
    await expect(laptop.getByRole('button', { name: /Abrir a montagem/ })).toHaveCount(3)
    await tv.getByRole('button', { name: 'Nova rodada' }).click()
    // Back at the camera first: a click while the print screen is leaving can miss the gallery button.
    await expect(tv.getByTestId('photo-counter')).toHaveText('1/3')
    await tv.getByRole('button', { name: 'Abrir a galeria' }).click()
    await expect(tv.getByRole('dialog', { name: 'Galeria' }).getByRole('button', { name: /Abrir a montagem/ })).toHaveCount(3)
  })

  test('RF14 loads thumbnail images as gallery tiles scroll into view', async ({ app, operatorWindow, dirs }) => {
    const folder = await seedFolder(dirs)
    for (let index = 0; index < 24; index++) {
      const name = '19-00-' + String(index).padStart(2, '0') + '.jpg'
      copyFileSync(join(folder, '20-00-00.jpg'), join(folder, name))
    }
    const tv = await startEvent(app, operatorWindow, { name: 'Festa' })

    const laptopTiles = operatorWindow.getByTestId('laptop-gallery').getByRole('button', { name: /Abrir a montagem/ })
    await expect(laptopTiles).toHaveCount(26)
    await laptopTiles.first().scrollIntoViewIfNeeded()
    await expect(laptopTiles.first().getByTestId('gallery-thumb')).toBeVisible()
    await expect(laptopTiles.last().getByTestId('gallery-thumb')).toHaveCount(0)
    await laptopTiles.last().scrollIntoViewIfNeeded()
    await expect(laptopTiles.last().getByTestId('gallery-thumb')).toBeVisible()

    await tv.getByRole('button', { name: 'Abrir a galeria' }).click()
    const tvTiles = tv.getByTestId('tv-gallery').getByRole('button', { name: /Abrir a montagem/ })
    await expect(tvTiles).toHaveCount(26)
    await expect(tvTiles.first().getByTestId('gallery-thumb')).toBeVisible()
    await expect(tvTiles.last().getByTestId('gallery-thumb')).toHaveCount(0)
    await tvTiles.last().scrollIntoViewIfNeeded()
    await expect(tvTiles.last().getByTestId('gallery-thumb')).toBeVisible()
  })

  test('RF14 opens a montage fullscreen', async ({ app, operatorWindow, dirs }) => {
    await seedFolder(dirs)
    const tv = await startEvent(app, operatorWindow, { name: 'Festa' })
    await tv.getByRole('button', { name: 'Abrir a galeria' }).click()
    await tv.getByRole('button', { name: 'Abrir a montagem 20-05-00.jpg' }).click()
    const viewer = tv.getByRole('dialog', { name: '20-05-00.jpg' })
    await expect(viewer.getByTestId('gallery-full-image')).toBeVisible()
    const natural = await viewer.getByTestId('gallery-full-image').evaluate((image: HTMLImageElement) => ({ width: image.naturalWidth, height: image.naturalHeight }))
    expect(natural).toEqual({ width: 1844, height: 1240 })
    await viewer.getByRole('button', { name: 'Voltar' }).click()
    await expect(viewer).toBeHidden()

    await operatorWindow.getByRole('button', { name: 'Abrir a montagem 20-00-00.jpg' }).click()
    await expect(operatorWindow.getByRole('dialog', { name: '20-00-00.jpg' }).getByTestId('gallery-full-image')).toBeVisible()
  })

  test('RF14 Imprimir novamente from the menu resends that file', async ({ app, operatorWindow, dirs }) => {
    const folder = await seedFolder(dirs)
    const tv = await startEvent(app, operatorWindow, { name: 'Festa' })
    await tv.getByRole('button', { name: 'Abrir a galeria' }).click()
    await tv.getByRole('button', { name: 'Abrir a montagem 20-00-00.jpg' }).click()
    const viewer = tv.getByRole('dialog', { name: '20-00-00.jpg' })
    await viewer.getByRole('button', { name: 'Mais opções' }).click()
    await viewer.getByRole('menuitem', { name: 'Imprimir novamente' }).click()
    await expect(viewer.getByTestId('gallery-reprint-status')).toHaveText('Montagem enviada para a impressora')
    expect(await simulatedTickets(dirs.userData)).toEqual([{ jpegPath: join(folder, '20-00-00.jpg'), copies: 1, mode: 'two-strips', cut: true, restorePreferences: true }])
    // No new file: the folder still has what it had.
    expect(readdirSync(folder).sort()).toEqual(['20-00-00.jpg', '20-05-00.jpg', 'IMG_0001.jpg', 'foto.png'])
  })
})
