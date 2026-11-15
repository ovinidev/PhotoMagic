import { mkdtempSync, readdirSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { Page } from '@playwright/test'
import sharp from 'sharp'
import { expect, test } from './fixtures'
import { PHOTO_TIMEOUT, startEvent, takePhotos } from './event'
import { writeY4m } from './y4m'

test.describe('capture round', () => {
  test('RF09 frames a slot without moving it and keeps shared captures independent', async ({ app, operatorWindow }) => {
    const tv = await startEvent(app, operatorWindow, { name: 'Festa' })
    await takePhotos(tv, 3)
    const state = () => operatorWindow.evaluate(() => window.fotomagica.session.getState())
    const before = await state()
    if (before.kind !== 'event') throw new Error('expected an event')
    const tvPreview = tv.getByTestId('print-preview')
    await expect(tvPreview).toBeVisible()
    const tvSrc = await tvPreview.getAttribute('src')

    // Zoom with the button, then drag the photo down inside Baixo 1.
    const bottom1 = operatorWindow.getByRole('button', { name: 'Enquadrar Baixo 1' })
    await bottom1.click()
    await operatorWindow.getByRole('button', { name: 'Aproximar' }).click()
    await expect(operatorWindow.getByTestId('framing-readout')).toHaveText('Baixo 1: zoom 1,25× · giro 0°')
    const box = (await bottom1.boundingBox())!
    await operatorWindow.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
    await operatorWindow.mouse.down()
    await operatorWindow.mouse.move(box.x + box.width / 2, box.y + box.height / 2 + 15, { steps: 5 })
    await operatorWindow.mouse.up()

    await expect.poll(async () => {
      const current = await state()
      return current.kind === 'event' ? current.framings['bottom-1']?.panY ?? 0 : 0
    }).toBeLessThan(0)
    const after = await state()
    if (after.kind !== 'event') throw new Error('expected an event')
    expect(after.framings['bottom-1']?.zoom).toBe(1.25)
    // Cima 1 uses the same capture and keeps its own, default framing; no slot rectangle moved.
    expect(after.framings['top-1']).toBeUndefined()
    expect(after.slots).toEqual(before.slots)
    // The TV print screen shows the recomposed preview.
    await expect.poll(() => tvPreview.getAttribute('src')).not.toBe(tvSrc)
    expect(after.previewRevision).toBeGreaterThan(before.previewRevision)
  })

  test('RF06 advances the counter 1/3, 2/3, 3/3 and moves to printing', async ({ app, operatorWindow }) => {
    const tv = await startEvent(app, operatorWindow, { name: 'Festa' })
    await expect(operatorWindow.getByTestId('round-status')).toHaveText('Foto 1/3')
    await takePhotos(tv, 2)
    await expect(operatorWindow.getByTestId('round-status')).toHaveText('Foto 3/3')
    await tv.getByRole('button', { name: 'Tirar foto' }).click()
    await expect(tv.getByTestId('print-screen')).toBeVisible()
    // The fourth tap has nothing to hit: the shutter is gone behind the print screen.
    await expect(tv.getByRole('button', { name: 'Tirar foto' })).toHaveCount(0)
    await expect(operatorWindow.getByTestId('round-status')).toHaveText('As 3 fotos estão prontas. Imprima ou cancele na TV.')
    await expect(operatorWindow.getByTestId('montage-preview')).toBeVisible()
  })

  test('RF06 laptop shutter triggers the same capture as the TV button', async ({ app, operatorWindow }) => {
    const tv = await startEvent(app, operatorWindow, { name: 'Festa' })
    await operatorWindow.getByRole('button', { name: 'Tirar foto' }).click()
    await expect(tv.getByTestId('photo-counter')).toHaveText('2/3', { timeout: PHOTO_TIMEOUT })
    await expect(operatorWindow.getByTestId('round-status')).toHaveText('Foto 2/3')
  })

  test('RF07 counts down 5 s and 10 s before capturing', async ({ app, operatorWindow }) => {
    const tv = await startEvent(app, operatorWindow, { name: 'Festa' })
    const countdown = tv.getByTestId('countdown')

    await tv.getByRole('radio', { name: '5 s' }).click()
    await tv.getByRole('button', { name: 'Tirar foto' }).click()
    await expect(countdown).toHaveText('5')
    // A tap during the countdown adds nothing.
    await tv.getByRole('button', { name: 'Tirar foto' }).click({ force: true })
    await expect(countdown).toHaveText('1', { timeout: 6_000 })
    await expect(tv.getByTestId('photo-counter')).toHaveText('1/3')
    await expect(tv.getByTestId('photo-counter')).toHaveText('2/3', { timeout: PHOTO_TIMEOUT })
    await expect(countdown).toHaveCount(0)

    await tv.getByRole('radio', { name: '10 s' }).click()
    await tv.getByRole('button', { name: 'Tirar foto' }).click()
    await expect(countdown).toHaveText('10')
    await expect(countdown).toHaveText('6', { timeout: 6_000 })
    await expect(tv.getByTestId('photo-counter')).toHaveText('2/3')
    await expect(tv.getByTestId('photo-counter')).toHaveText('3/3', { timeout: 5_000 + PHOTO_TIMEOUT })
  })

  test('RF07 syncs the timer between the TV and the laptop', async ({ app, operatorWindow }) => {
    const tv = await startEvent(app, operatorWindow, { name: 'Festa' })
    await tv.getByRole('radio', { name: '5 s' }).click()
    await expect(operatorWindow.getByLabel('Timer')).toHaveValue('5')
    await operatorWindow.getByLabel('Timer').selectOption({ label: '10 s' })
    await expect(tv.getByRole('radio', { name: '10 s' })).toHaveAttribute('aria-checked', 'true')
    await operatorWindow.getByLabel('Timer').selectOption({ label: 'Sem timer' })
    await expect(tv.getByRole('radio', { name: 'Sem timer' })).toHaveAttribute('aria-checked', 'true')
  })

  test('RF10 Cancelar returns to the camera at 1/3 with no file', async ({ app, operatorWindow, dirs }) => {
    const tv = await startEvent(app, operatorWindow, { name: 'Festa' })
    await takePhotos(tv, 3)
    await tv.getByRole('button', { name: 'Cancelar' }).click()
    await expect(tv.getByTestId('print-screen')).toHaveCount(0)
    await expect(tv.getByTestId('photo-counter')).toHaveText('1/3')
    expect(readdirSync(join(dirs.desktop, 'Festa'))).toEqual([])
  })

  test('RNF04 the laptop shows the live camera sent by the TV over the MessageChannel', async ({ app, operatorWindow }) => {
    await startEvent(app, operatorWindow, { name: 'Festa', mode: 'one-strip' })
    await expect(operatorWindow.getByTestId('live-preview')).toHaveAttribute('data-receiving', 'true')
    await expect(operatorWindow.getByTestId('live-guide')).toBeVisible()
  })
})

/**
 * RF05 fixture: a 640×360 landscape "sensor" frame, gray, with a red mark along its left edge and a
 * blue mark in the middle of its top edge. Rotated 90° clockwise and then mirrored (DESIGN §5), the
 * left edge becomes the top of the portrait and the top edge becomes its left side. An upside-down
 * rotation would put red at the bottom; a missing mirror would put blue on the right.
 */
const SENSOR = { width: 640, height: 360 }
const RED = [255, 0, 0] as const
const BLUE = [0, 0, 255] as const
const GRAY = [128, 128, 128] as const
const fixtureFrame = join(mkdtempSync(join(tmpdir(), 'fotomagica-e2e-')), 'rf05-sensor.y4m')
writeY4m(fixtureFrame, SENSOR, GRAY, [
  { x: 0, y: 0, width: 80, height: 360, color: RED },
  { x: 200, y: 0, width: 240, height: 60, color: BLUE },
])

/** Reads the preview canvas at points given as fractions of its width and height. */
function sampleCanvas(tv: Page, points: Array<[x: number, y: number]>): Promise<number[][]> {
  return tv.getByTestId('camera-preview').evaluate((canvas: HTMLCanvasElement, at) => {
    const context = canvas.getContext('2d')
    if (!context || canvas.width === 0) return []
    return at.map(([x, y]) => Array.from(context.getImageData(Math.floor(x * canvas.width), Math.floor(y * canvas.height), 1, 1).data.slice(0, 3)))
  }, points)
}

function closeTo(actual: readonly number[] | undefined, expected: readonly number[]): boolean {
  return !!actual && actual.every((value, index) => Math.abs(value - expected[index]!) <= 40)
}

test.describe('capture round: live view and file (RF05)', () => {
  test.use({ appEnv: { FOTOMAGICA_FAKE_CAMERA: fixtureFrame } })

  test('RF05 shows the fixture frame mirrored and upright on the TV, and the montage JPG matches', async ({ app, operatorWindow, dirs }) => {
    const tv = await startEvent(app, operatorWindow, { name: 'Festa', mode: 'one-strip' })
    await expect(operatorWindow.getByTestId('camera-status')).toContainText('640 × 360')

    const points: Array<[number, number]> = [
      [0.5, 0.06], // top center: the sensor's left edge
      [0.08, 0.5], // left middle: the middle of the sensor's top edge
      [0.92, 0.5], // right middle: gray (blue here would mean no mirror)
      [0.5, 0.94], // bottom center: gray (red here would mean upside down)
    ]
    await expect
      .poll(async () => {
        const [top, left, right, bottom] = await sampleCanvas(tv, points)
        return closeTo(top, RED) && closeTo(left, BLUE) && closeTo(right, GRAY) && closeTo(bottom, GRAY)
      }, { timeout: 10_000 })
      .toBe(true)

    // The file: one-strip slot 1 is 560×1160 at (42, 40); the 360×640 portrait covers it at 1.8125×.
    await takePhotos(tv, 3)
    await tv.getByRole('button', { name: 'Imprimir' }).click()
    await expect(tv.getByTestId('print-screen')).toHaveAttribute('data-phase', 'printed', { timeout: PHOTO_TIMEOUT })
    const [file] = readdirSync(join(dirs.desktop, 'Festa'))
    const { data, info } = await sharp(join(dirs.desktop, 'Festa', file!)).raw().toBuffer({ resolveWithObject: true })
    const at = (x: number, y: number) => Array.from(data.subarray((y * info.width + x) * info.channels, (y * info.width + x) * info.channels + 3))
    expect(closeTo(at(322, 80), RED), 'top of slot 1 is the sensor left edge').toBe(true)
    expect(closeTo(at(60, 620), BLUE), 'left of slot 1 is the sensor top edge (mirrored)').toBe(true)
    expect(closeTo(at(580, 620), GRAY), 'right of slot 1 is gray').toBe(true)
    expect(closeTo(at(322, 1150), GRAY), 'bottom of slot 1 is gray').toBe(true)
  })
})
