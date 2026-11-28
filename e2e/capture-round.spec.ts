import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { Page } from '@playwright/test'
import sharp from 'sharp'
import { expect, test } from './fixtures'
import { PHOTO_TIMEOUT, PRINT_TIMEOUT, startEvent, montagesIn, takePhotos } from './event'
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

    // Baixo 1's card stands at Angle 270, so the pan is stored in the card's turned frame: a drag down
    // moves the photo along that frame's x axis.
    await expect.poll(async () => {
      const current = await state()
      const framing = current.kind === 'event' ? current.framings['bottom-1'] : undefined
      return Math.abs(framing?.panX ?? 0) + Math.abs(framing?.panY ?? 0)
    }).toBeGreaterThan(0)
    const after = await state()
    if (after.kind !== 'event') throw new Error('expected an event')
    expect(after.framings['bottom-1']?.zoom).toBe(1.25)
    // Cima 1 uses the same capture and keeps its own, default framing; no slot rectangle moved.
    expect(after.framings['top-1']).toBeUndefined()
    expect(after.slots).toEqual(before.slots)
    // The TV print screen shows the recomposed preview.
    await expect.poll(() => tvPreview.getAttribute('src')).not.toBe(tvSrc)
    await expect.poll(async () => {
      const latest = await state()
      return latest.kind === 'event' ? latest.previewRevision : 0
    }).toBeGreaterThan(before.previewRevision)
  })

  test('RF09 draws the framed photo locally, clipped to its fixed box: nothing outside the box changes', async ({ app, operatorWindow }) => {
    const tv = await startEvent(app, operatorWindow, { name: 'Festa' })
    await takePhotos(tv, 3)
    await expect(tv.getByTestId('print-preview')).toBeVisible()
    const overlay = operatorWindow.getByTestId('framing-overlay')
    const bottom1 = operatorWindow.getByRole('button', { name: 'Enquadrar Baixo 1' })
    const mask = overlay.locator('[data-mask-for="bottom-1"]')
    const photo = mask.getByTestId('framing-photo')
    await expect(photo).toBeVisible()
    expect(await mask.evaluate((node) => getComputedStyle(node).overflow)).toBe('hidden')
    expect(parseFloat(await mask.evaluate((node) => getComputedStyle(node).borderTopLeftRadius))).toBeGreaterThan(0)

    const revision = async () => {
      const current = await operatorWindow.evaluate(() => window.fotomagica.session.getState())
      return current.kind === 'event' ? current.previewRevision : 0
    }
    /** Waits until main has composed the latest framing and the laptop shows it. */
    const settle = async () => {
      await app.evaluate(() => new Promise((done) => setTimeout(done, 300)))
      const target = await revision()
      await expect.poll(revision).toBeGreaterThanOrEqual(target)
      await expect(operatorWindow.getByTestId('montage-preview')).toBeVisible()
      await operatorWindow.waitForTimeout(300)
    }
    const shot = async () => {
      // The pointer off the sheet: a hover outline on a neighbouring slot is not a framing change.
      await operatorWindow.mouse.move(1, 1)
      const { data, info } = await sharp(await overlay.screenshot()).raw().toBuffer({ resolveWithObject: true })
      return { data, info }
    }

    await bottom1.click()
    await settle()
    const before = await shot()
    const area = (await overlay.boundingBox())!
    const slot = (await bottom1.boundingBox())!

    // Zoom far in, then drag hard: the photo element grows past the slot, the mask clips it.
    for (let step = 0; step < 5; step += 1) await operatorWindow.getByRole('button', { name: 'Aproximar' }).click()
    const center = { x: slot.x + slot.width / 2, y: slot.y + slot.height / 2 }
    await operatorWindow.mouse.move(center.x, center.y)
    await operatorWindow.mouse.down()
    await operatorWindow.mouse.move(center.x + 120, center.y + 90, { steps: 12 })
    await operatorWindow.mouse.up()
    const drawn = (await photo.boundingBox())!
    expect(drawn.width).toBeGreaterThan(slot.width * 1.5)
    await settle()
    const after = await shot()

    // Every pixel outside Baixo 1 (plus a few px of anti-aliasing and the selection border) is unchanged.
    const scale = before.info.width / area.width
    const margin = 4 * scale
    const x0 = (slot.x - area.x) * scale - margin
    const y0 = (slot.y - area.y) * scale - margin
    const x1 = (slot.x + slot.width - area.x) * scale + margin
    const y1 = (slot.y + slot.height - area.y) * scale + margin
    let changed = 0
    for (let y = 0; y < before.info.height; y += 1) {
      for (let x = 0; x < before.info.width; x += 1) {
        if (x >= x0 && x <= x1 && y >= y0 && y <= y1) continue
        const at = (y * before.info.width + x) * before.info.channels
        if ([0, 1, 2].some((c) => Math.abs(before.data[at + c]! - after.data[at + c]!) > 24)) changed += 1
      }
    }
    expect(changed).toBe(0)
  })

  test('RF06 advances the counter 1/3, 2/3, 3/3 and moves to printing', async ({ app, operatorWindow }) => {
    const tv = await startEvent(app, operatorWindow, { name: 'Festa' })
    await expect(operatorWindow.getByTestId('round-status')).toHaveText('Foto 1/3')
    await takePhotos(tv, 2)
    await expect(operatorWindow.getByTestId('round-status')).toHaveText('Foto 3/3')
    await tv.getByRole('button', { name: 'Tirar foto' }).click()
    // The third capture, then the montage preview: same headroom as `takePhotos`.
    await expect(tv.getByTestId('print-screen')).toBeVisible({ timeout: PHOTO_TIMEOUT })
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
    // 15 s of countdown plus two captures exceeds the 30 s default on a loaded runner.
    test.setTimeout(60_000)
    const tv = await startEvent(app, operatorWindow, { name: 'Festa' })
    const countdown = tv.getByTestId('countdown')

    // Each digit is on screen for one second, shorter than Playwright's retry step on a loaded
    // runner, so assert ranges of digits and the elapsed time instead of one exact transient digit.
    await tv.getByRole('radio', { name: '5 s' }).click()
    await tv.getByRole('button', { name: 'Tirar foto' }).click()
    await expect(countdown).toHaveText('5')
    const fiveStarted = Date.now()
    // A tap during the countdown adds nothing.
    await tv.getByRole('button', { name: 'Tirar foto' }).click({ force: true })
    await expect(countdown).toHaveText(/^[1-4]$/)
    await expect(tv.getByTestId('photo-counter')).toHaveText('1/3')
    await expect(tv.getByTestId('photo-counter')).toHaveText('2/3', { timeout: 5_000 + PHOTO_TIMEOUT })
    // '5' was seen within its first second, so the capture cannot come sooner than 4 s later.
    expect(Date.now() - fiveStarted).toBeGreaterThanOrEqual(4_000)
    await expect(countdown).toHaveCount(0)

    await tv.getByRole('radio', { name: '10 s' }).click()
    await tv.getByRole('button', { name: 'Tirar foto' }).click()
    await expect(countdown).toHaveText('10')
    const tenStarted = Date.now()
    await expect(countdown).toHaveText(/^[1-9]$/)
    await expect(tv.getByTestId('photo-counter')).toHaveText('2/3')
    await expect(tv.getByTestId('photo-counter')).toHaveText('3/3', { timeout: 10_000 + PHOTO_TIMEOUT })
    expect(Date.now() - tenStarted).toBeGreaterThanOrEqual(9_000)
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
    expect(montagesIn(join(dirs.desktop, 'Festa'))).toEqual([])
  })

  test('DESIGN §14 the print screen appears and leaves at once, with no animation', async ({ app, operatorWindow }) => {
    const tv = await startEvent(app, operatorWindow, { name: 'Festa' })
    await takePhotos(tv, 3)
    const layer = tv.getByTestId('guest-screen')
    await expect(layer).toBeVisible()
    expect(await layer.evaluate((node) => getComputedStyle(node).animationName)).toBe('none')
    await tv.getByRole('button', { name: 'Cancelar' }).click()
    await expect(tv.getByTestId('print-screen')).toHaveCount(0)
    await expect(tv.getByTestId('guest-screen')).toHaveCount(0)
  })

  test('RNF04 only the TV shows the live camera', async ({ app, operatorWindow }) => {
    const tv = await startEvent(app, operatorWindow, { name: 'Festa', mode: 'one-strip' })
    await expect(tv.getByTestId('camera-preview')).toBeVisible()
    await expect(operatorWindow.getByText('Câmera ao vivo', { exact: true })).toBeVisible()
    await expect(operatorWindow.locator('video, canvas')).toHaveCount(0)
    await takePhotos(tv, 1)
    await expect(operatorWindow.getByTestId('montage-preview')).toBeVisible()
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
    await expect(tv.getByTestId('print-screen')).toHaveAttribute('data-phase', 'printed', { timeout: PRINT_TIMEOUT })
    const [file] = montagesIn(join(dirs.desktop, 'Festa'))
    const { data, info } = await sharp(join(dirs.desktop, 'Festa', file!)).raw().toBuffer({ resolveWithObject: true })
    const at = (x: number, y: number) => Array.from(data.subarray((y * info.width + x) * info.channels, (y * info.width + x) * info.channels + 3))
    expect(closeTo(at(322, 80), RED), 'top of slot 1 is the sensor left edge').toBe(true)
    expect(closeTo(at(60, 620), BLUE), 'left of slot 1 is the sensor top edge (mirrored)').toBe(true)
    expect(closeTo(at(580, 620), GRAY), 'right of slot 1 is gray').toBe(true)
    expect(closeTo(at(322, 1150), GRAY), 'bottom of slot 1 is gray').toBe(true)
  })
})
