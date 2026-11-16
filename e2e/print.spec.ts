import { copyFileSync, mkdirSync, mkdtempSync, readdirSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import sharp from 'sharp'
import { TWO_STRIPS_CLIENT_BOXES } from '@shared/layout'
import { expect, test } from './fixtures'
import { PRINT_TIMEOUT, setSimulatedPrinter, simulatedTickets, startEvent, takePhotos } from './event'
import { writeY4m } from './y4m'

/** The client's real 2 tiras artwork (Canva PDF rendered at 1844×1240): black rounded photo boxes. */
const CLIENT_TEMPLATE = resolve(__dirname, 'fixtures/client-2tiras-1844x1240.png')

/**
 * A bright 1920×1080 sensor frame with no dark color, so any dark pixel left in a photo box is the
 * artwork's black showing through. The sensor's left band becomes the top of the portrait (DESIGN §5).
 */
const brightFrame = join(mkdtempSync(join(tmpdir(), 'fotomagica-e2e-')), 'client-sensor.y4m')
writeY4m(brightFrame, { width: 1920, height: 1080 }, [176, 208, 236], [
  { x: 0, y: 0, width: 240, height: 1080, color: [250, 214, 110] },
  { x: 640, y: 200, width: 900, height: 680, color: [226, 168, 140] },
  { x: 1540, y: 0, width: 380, height: 1080, color: [140, 186, 120] },
])

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
    await expect(tv.getByTestId('print-screen')).toHaveAttribute('data-phase', 'printed', { timeout: PRINT_TIMEOUT })
    const [file] = readdirSync(join(dirs.desktop, 'Festa'))
    expect(await simulatedTickets(dirs.userData)).toEqual([{ jpegPath: join(dirs.desktop, 'Festa', file!), copies: 2, mode: 'two-strips', cut: true }])
  })

  test('RF11 1 tira writes a simulated ticket with cut off', async ({ app, operatorWindow, dirs }) => {
    const tv = await startEvent(app, operatorWindow, { name: 'Festa', mode: 'one-strip' })
    await takePhotos(tv, 3)
    await tv.getByRole('button', { name: 'Imprimir' }).click()
    await expect(tv.getByTestId('print-screen')).toHaveAttribute('data-phase', 'printed', { timeout: PRINT_TIMEOUT })
    expect(await simulatedTickets(dirs.userData)).toEqual([expect.objectContaining({ copies: 1, mode: 'one-strip', cut: false })])
  })

  test('RF12 saves a single HH-mm-ss.jpg montage of 1844×1240 at 300 DPI', async ({ app, operatorWindow, dirs }) => {
    const tv = await startEvent(app, operatorWindow, { name: 'Festa' })
    await takePhotos(tv, 3)
    const started = performance.now()
    await tv.getByRole('button', { name: 'Imprimir' }).click()
    await expect(tv.getByTestId('print-screen')).toHaveAttribute('data-phase', 'printed', { timeout: PRINT_TIMEOUT })
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
    await expect(tv.getByRole('button', { name: 'Imprimir novamente' })).toBeVisible({ timeout: PRINT_TIMEOUT })
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
      await expect(tv.getByTestId('print-screen')).toHaveAttribute('data-phase', 'print-failed', { timeout: PRINT_TIMEOUT })
      await expect(tv.getByText('Não foi possível ajustar o corte da impressora')).toBeVisible()
      await expect(operatorWindow.getByTestId('round-status')).toHaveText('Não foi possível ajustar o corte da impressora')
      await expect(tv.getByRole('button', { name: 'Imprimir novamente' })).toHaveCount(0)
      expect(await simulatedTickets(dirs.userData)).toEqual([])
    })
  })

  test.describe('when the driver refuses the cut, then accepts it', () => {
    test.use({ appEnv: { FOTOMAGICA_PRINTER_CUT: 'unsupported' } })

    test('RF11 Tentar novamente resends the saved JPG with the cut on', async ({ app, operatorWindow, dirs }) => {
      const tv = await startEvent(app, operatorWindow, { name: 'Festa', mode: 'two-strips' })
      await takePhotos(tv, 3)
      await tv.getByRole('button', { name: 'Imprimir' }).click()
      await expect(tv.getByTestId('print-screen')).toHaveAttribute('data-phase', 'print-failed', { timeout: PRINT_TIMEOUT })
      await expect(operatorWindow.getByTestId('round-status-detail')).toContainText('Detalhe técnico:')
      const files = readdirSync(join(dirs.desktop, 'Festa'))
      await setSimulatedPrinter(app, { cut: 'supported' })
      await tv.getByRole('button', { name: 'Tentar novamente' }).click()
      await expect(tv.getByTestId('print-screen')).toHaveAttribute('data-phase', 'printed', { timeout: PRINT_TIMEOUT })
      expect(await simulatedTickets(dirs.userData)).toEqual([{ jpegPath: join(dirs.desktop, 'Festa', files[0]!), copies: 1, mode: 'two-strips', cut: true }])
      expect(readdirSync(join(dirs.desktop, 'Festa'))).toEqual(files)
    })
  })

  test.describe('with the printer out of paper, then refilled', () => {
    test.use({ appEnv: { FOTOMAGICA_PRINTER_STATUS: 'no-paper' } })

    test('RNF10 laptop and TV show the state; RF13 Tentar novamente prints the same JPG once the paper is back', async ({ app, operatorWindow, dirs }) => {
      const tv = await startEvent(app, operatorWindow, { name: 'Festa', mode: 'one-strip' })
      await expect(operatorWindow.getByTestId('printer-status')).toHaveAttribute('data-kind', 'no-paper')
      await expect(operatorWindow.getByTestId('printer-status')).toContainText('Impressora sem papel')
      await takePhotos(tv, 3)
      // The TV warns before anyone taps Imprimir.
      await expect(tv.getByTestId('tv-printer-status')).toHaveText('Impressora sem papel')
      await tv.getByRole('button', { name: 'Imprimir' }).click()
      await expect(tv.getByTestId('print-screen')).toHaveAttribute('data-phase', 'print-failed', { timeout: PRINT_TIMEOUT })
      await expect(operatorWindow.getByTestId('round-status')).toHaveText('Impressora sem papel')
      const files = readdirSync(join(dirs.desktop, 'Festa'))
      expect(files).toHaveLength(1)

      await setSimulatedPrinter(app, { status: 'ready' })
      await expect(operatorWindow.getByTestId('printer-status')).toHaveAttribute('data-kind', 'ready')
      await tv.getByRole('button', { name: 'Tentar novamente' }).click()
      await expect(tv.getByTestId('print-screen')).toHaveAttribute('data-phase', 'printed', { timeout: PRINT_TIMEOUT })
      await expect(operatorWindow.getByTestId('round-status')).toHaveText(`Impresso: ${files[0]}`)
      expect(await simulatedTickets(dirs.userData)).toEqual([{ jpegPath: join(dirs.desktop, 'Festa', files[0]!), copies: 1, mode: 'one-strip', cut: false }])
      expect(readdirSync(join(dirs.desktop, 'Festa'))).toEqual(files)
    })
  })

  test.describe('with the printer out of paper', () => {
    test.use({ appEnv: { FOTOMAGICA_PRINTER_STATUS: 'no-paper' } })

    test('RNF10 printer offline, no paper or no ribbon keeps the round and shows the state', async ({ app, operatorWindow, dirs }) => {
      const tv = await startEvent(app, operatorWindow, { name: 'Festa' })
      await takePhotos(tv, 3)
      await tv.getByRole('button', { name: 'Imprimir' }).click()
      // The TV already warns before Imprimir, so wait for the failure itself, not only the words.
      await expect(tv.getByTestId('print-screen')).toHaveAttribute('data-phase', 'print-failed', { timeout: PRINT_TIMEOUT })
      await expect(tv.getByText('Impressora sem papel')).toBeVisible()
      // The JPG is written before sending and stays; trying again resends that same file.
      const files = readdirSync(join(dirs.desktop, 'Festa'))
      expect(files).toHaveLength(1)
      await expect(tv.getByText(`A montagem ${files[0]} ficou salva na pasta do evento.`)).toBeVisible()
      await tv.getByRole('button', { name: 'Tentar novamente' }).click()
      await expect(tv.getByTestId('print-screen')).toHaveAttribute('data-phase', 'print-failed', { timeout: PRINT_TIMEOUT })
      await expect(tv.getByText('Impressora sem papel')).toBeVisible()
      expect(readdirSync(join(dirs.desktop, 'Festa'))).toEqual(files)
    })
  })
})

test.describe('print: client 2 tiras artwork', () => {
  test.use({ appEnv: { FOTOMAGICA_FAKE_CAMERA: brightFrame } })

  test('RF08 RF12 fills the client photo boxes with no black corner and leaves the art untouched', async ({ app, operatorWindow, dirs }) => {
    const tv = await startEvent(app, operatorWindow, { name: 'Festa LB', mode: 'two-strips', template: CLIENT_TEMPLATE })
    await takePhotos(tv, 3)
    await tv.getByRole('button', { name: 'Imprimir' }).click()
    await expect(tv.getByTestId('print-screen')).toHaveAttribute('data-phase', 'printed', { timeout: PRINT_TIMEOUT })
    const [file] = readdirSync(join(dirs.desktop, 'Festa LB'))
    const montage = join(dirs.desktop, 'Festa LB', file!)

    const { data, info } = await sharp(montage).raw().toBuffer({ resolveWithObject: true })
    expect(info).toMatchObject({ width: 1844, height: 1240 })
    const art = await sharp(CLIENT_TEMPLATE).removeAlpha().raw().toBuffer()
    const at = (buffer: Buffer, x: number, y: number) => {
      const i = (y * 1844 + x) * 3
      return [buffer[i]!, buffer[i + 1]!, buffer[i + 2]!]
    }
    for (const box of TWO_STRIPS_CLIENT_BOXES) {
      let black = 0
      for (let y = box.top; y < box.top + box.height; y++) {
        for (let x = box.left; x < box.left + box.width; x++) if (at(data, x, y).every((value) => value < 60)) black++
      }
      expect(black, `black pixels in the box at ${box.left},${box.top}`).toBe(0)
      // No gray hairline from the artwork's anti-aliased edge, just inside or outside each side.
      const midY = box.top + Math.floor(box.height / 2)
      for (const x of [box.left - 1, box.left, box.left + box.width - 1, box.left + box.width]) {
        const [r, g, b] = at(data, x, midY)
        expect(Math.abs(r! - g!) < 14 && Math.abs(g! - b!) < 14 && r! < 225, `edge ${x},${midY} = ${r},${g},${b}`).toBe(false)
      }
    }
    // Outside the boxes the montage is the artwork (the monogram corner on the right), up to JPEG noise.
    let diff = 0
    let count = 0
    for (let y = 60; y < 560; y += 4) {
      for (let x = 1330; x < 1830; x += 4) {
        const a = at(data, x, y)
        const b = at(art, x, y)
        diff += Math.abs(a[0]! - b[0]!) + Math.abs(a[1]! - b[1]!) + Math.abs(a[2]! - b[2]!)
        count += 3
      }
    }
    expect(diff / count).toBeLessThan(4)

    // Owner sample, only when asked for (not in CI): FOTOMAGICA_SAMPLE_OUT=/path/montage.png.
    const sample = process.env.FOTOMAGICA_SAMPLE_OUT
    if (sample) {
      mkdirSync(dirname(sample), { recursive: true })
      if (sample.endsWith('.png')) await sharp(montage).png().toFile(sample)
      else copyFileSync(montage, sample)
    }
  })

  test('PRD §6.1 with no template a round prints the photos in the standard rounded boxes on plain white', async ({ app, operatorWindow, dirs }) => {
    const tv = await startEvent(app, operatorWindow, { name: 'Festa Branca', mode: 'two-strips', template: null })
    await takePhotos(tv, 3)
    await tv.getByRole('button', { name: 'Imprimir' }).click()
    await expect(tv.getByTestId('print-screen')).toHaveAttribute('data-phase', 'printed', { timeout: PRINT_TIMEOUT })
    const files = readdirSync(join(dirs.desktop, 'Festa Branca'))
    expect(files).toHaveLength(1)
    expect(files[0]).toMatch(MONTAGE)

    const { data, info } = await sharp(join(dirs.desktop, 'Festa Branca', files[0]!)).raw().toBuffer({ resolveWithObject: true })
    expect(info).toMatchObject({ width: 1844, height: 1240 })
    const at = (x: number, y: number) => {
      const i = (y * info.width + x) * info.channels
      return [data[i]!, data[i + 1]!, data[i + 2]!]
    }
    const white = (x: number, y: number) => at(x, y).every((value) => value > 245)
    // Outside the boxes: the white default sheet (margins, the gap at the cut line, the right side).
    for (const [x, y] of [[8, 8], [1835, 1230], [900, 650], [1600, 300], [1500, 1000]] as const) {
      expect(white(x, y), `white at ${x},${y} = ${at(x, y).join(',')}`).toBe(true)
    }
    for (const box of TWO_STRIPS_CLIENT_BOXES) {
      // The photo fills each standard box...
      const cx = box.left + Math.floor(box.width / 2)
      const cy = box.top + Math.floor(box.height / 2)
      expect(white(cx, cy), `photo at ${cx},${cy}`).toBe(false)
      expect(white(box.left + 40, box.top + box.height - 40), `photo inside ${box.left},${box.top}`).toBe(false)
      // ...clipped to its rounded corner: the very corner pixel stays white.
      expect(white(box.left + 2, box.top + 2), `rounded corner of ${box.left},${box.top}`).toBe(true)
    }
  })
})
