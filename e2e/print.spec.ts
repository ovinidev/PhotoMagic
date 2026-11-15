import { readdirSync } from 'node:fs'
import { join } from 'node:path'
import sharp from 'sharp'
import { expect, test } from './fixtures'
import { simulatedTickets, startEvent, takePhotos } from './event'

// Each capture is a full-resolution 4K JPEG encoded in software under xvfb (see PHOTO_TIMEOUT).
test.describe.configure({ timeout: 90_000 })

const MONTAGE = /^\d{2}-\d{2}-\d{2}(-\d+)?\.jpg$/

test.describe('print', () => {
  test('RF10 Mais stops at 10 and Menos stops at 1', async ({ app, operatorWindow }) => {
    const tv = await startEvent(app, operatorWindow, { name: 'Festa' })
    await takePhotos(tv, 3)
    const copies = tv.getByTestId('copies')
    const more = tv.getByRole('button', { name: 'Mais' })
    const less = tv.getByRole('button', { name: 'Menos' })
    await expect(copies).toHaveText('1 Cópia')
    await expect(less).toBeDisabled()
    for (let count = 2; count <= 10; count++) {
      await more.click()
      await expect(copies).toHaveText(`${count} Cópias`)
    }
    await expect(more).toBeDisabled()
    // The laptop shows the same count.
    await expect(operatorWindow.getByTestId('laptop-copies')).toHaveText('10 Cópias')
    await operatorWindow.getByRole('button', { name: 'Menos' }).click()
    await expect(copies).toHaveText('9 Cópias')
  })

  test('RF11 2 tiras writes a simulated ticket with cut on', async ({ app, operatorWindow, dirs }) => {
    const tv = await startEvent(app, operatorWindow, { name: 'Festa', mode: 'two-strips' })
    await takePhotos(tv, 3)
    await tv.getByRole('button', { name: 'Mais' }).click()
    await tv.getByRole('button', { name: 'Imprimir' }).click()
    await expect(tv.getByTestId('print-screen')).toHaveAttribute('data-phase', 'printed')
    const [file] = readdirSync(join(dirs.desktop, 'Festa'))
    expect(await simulatedTickets(dirs.userData)).toEqual([{ jpegPath: join(dirs.desktop, 'Festa', file!), copies: 2, mode: 'two-strips', cut: true }])
  })

  test('RF11 1 tira writes a simulated ticket with cut off', async ({ app, operatorWindow, dirs }) => {
    const tv = await startEvent(app, operatorWindow, { name: 'Festa', mode: 'one-strip' })
    await takePhotos(tv, 3)
    await tv.getByRole('button', { name: 'Imprimir' }).click()
    await expect(tv.getByTestId('print-screen')).toHaveAttribute('data-phase', 'printed')
    expect(await simulatedTickets(dirs.userData)).toEqual([expect.objectContaining({ copies: 1, mode: 'one-strip', cut: false })])
  })

  test('RF12 saves a single HH-mm-ss.jpg montage of 1844×1240 at 300 DPI', async ({ app, operatorWindow, dirs }) => {
    const tv = await startEvent(app, operatorWindow, { name: 'Festa' })
    await takePhotos(tv, 3)
    const started = performance.now()
    await tv.getByRole('button', { name: 'Imprimir' }).click()
    await expect(tv.getByTestId('print-screen')).toHaveAttribute('data-phase', 'printed')
    // RNF04: the CI ceiling for composing a fixture round is a loose 5 s.
    expect(performance.now() - started).toBeLessThan(5_000)
    const files = readdirSync(join(dirs.desktop, 'Festa'))
    expect(files).toHaveLength(1)
    expect(files[0]).toMatch(MONTAGE)
    await expect(operatorWindow.getByTestId('round-status')).toHaveText(`Impresso: ${files[0]}`)
    const meta = await sharp(join(dirs.desktop, 'Festa', files[0]!)).metadata()
    expect(meta).toMatchObject({ format: 'jpeg', width: 1844, height: 1240, density: 300 })
  })

  test('RF13 Imprimir novamente resends the same JPG without a new file', async ({ app, operatorWindow, dirs }) => {
    const tv = await startEvent(app, operatorWindow, { name: 'Festa' })
    await takePhotos(tv, 3)
    await tv.getByRole('button', { name: 'Imprimir' }).click()
    await expect(tv.getByRole('button', { name: 'Imprimir novamente' })).toBeVisible()
    await tv.getByRole('button', { name: 'Mais' }).click()
    await tv.getByRole('button', { name: 'Imprimir novamente' }).click()
    await expect.poll(async () => (await simulatedTickets(dirs.userData)).length).toBe(2)
    const [first, second] = await simulatedTickets(dirs.userData)
    expect(second).toEqual({ ...first, copies: 2 })
    expect(readdirSync(join(dirs.desktop, 'Festa'))).toHaveLength(1)
  })

  test('RF13 Nova rodada returns to the camera at 1/3', async ({ app, operatorWindow, dirs }) => {
    const tv = await startEvent(app, operatorWindow, { name: 'Festa' })
    await takePhotos(tv, 3)
    await tv.getByRole('button', { name: 'Imprimir' }).click()
    await tv.getByRole('button', { name: 'Nova rodada' }).click()
    await expect(tv.getByTestId('print-screen')).toHaveCount(0)
    await expect(tv.getByTestId('photo-counter')).toHaveText('1/3')
    await expect(operatorWindow.getByTestId('laptop-copies')).toHaveText('1 Cópia')
    expect(readdirSync(join(dirs.desktop, 'Festa'))).toHaveLength(1)
  })

  test.describe('when the driver refuses the cut', () => {
    test.use({ appEnv: { FOTOMAGICA_PRINTER_CUT: 'unsupported' } })

    test('RF11 reports cut-unavailable and does not treat the sheet as printed', async ({ app, operatorWindow, dirs }) => {
      const tv = await startEvent(app, operatorWindow, { name: 'Festa' })
      await takePhotos(tv, 3)
      await tv.getByRole('button', { name: 'Imprimir' }).click()
      await expect(tv.getByTestId('print-screen')).toHaveAttribute('data-phase', 'print-failed')
      await expect(tv.getByText('Não foi possível ajustar o corte da impressora')).toBeVisible()
      await expect(operatorWindow.getByTestId('round-status')).toHaveText('Não foi possível ajustar o corte da impressora')
      await expect(tv.getByRole('button', { name: 'Imprimir novamente' })).toHaveCount(0)
      expect(await simulatedTickets(dirs.userData)).toEqual([])
    })
  })

  test.describe('with the printer out of paper', () => {
    test.use({ appEnv: { FOTOMAGICA_PRINTER_STATUS: 'no-paper' } })

    test('RNF10 printer offline, no paper or no ribbon keeps the round and shows the state', async ({ app, operatorWindow, dirs }) => {
      const tv = await startEvent(app, operatorWindow, { name: 'Festa' })
      await takePhotos(tv, 3)
      await tv.getByRole('button', { name: 'Imprimir' }).click()
      await expect(tv.getByText('Impressora sem papel')).toBeVisible()
      // The JPG is written before sending and stays; trying again resends that same file.
      const files = readdirSync(join(dirs.desktop, 'Festa'))
      expect(files).toHaveLength(1)
      await expect(tv.getByText(`A montagem ${files[0]} ficou salva na pasta do evento.`)).toBeVisible()
      await tv.getByRole('button', { name: 'Tentar novamente' }).click()
      await expect(tv.getByText('Impressora sem papel')).toBeVisible()
      expect(readdirSync(join(dirs.desktop, 'Festa'))).toEqual(files)
    })
  })
})
