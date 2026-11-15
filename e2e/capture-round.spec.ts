import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { Page } from '@playwright/test'
import { expect, test } from './fixtures'
import { openTv } from './tv'
import { writeY4m } from './y4m'

// PRD scenarios whose screens do not exist yet. Each becomes a real test in the PR that builds its screen.
test.describe('capture round', () => {
  test.fixme('RF06 advances the counter 1/3, 2/3, 3/3 and moves to printing', async () => {})
  test.fixme('RF06 laptop shutter triggers the same capture as the TV button', async () => {})
  test.fixme('RF07 counts down 5 s and 10 s before capturing', async () => {})
  test.fixme('RF07 syncs the timer between the TV and the laptop', async () => {})
  test.fixme('RF09 frames a slot without moving it and keeps shared captures independent', async () => {})
  test.fixme('RF10 Cancelar returns to the camera at 1/3 with no file', async () => {})
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

function closeTo(actual: number[] | undefined, expected: readonly number[]): boolean {
  return !!actual && actual.every((value, index) => Math.abs(value - expected[index]!) <= 40)
}

test.describe('capture round: live view (RF05)', () => {
  test.use({ appEnv: { FOTOMAGICA_FAKE_CAMERA: fixtureFrame } })

  test('RF05 shows the fixture frame mirrored and upright on the TV', async ({ app, operatorWindow }) => {
    const tv = await openTv(app, operatorWindow)
    await expect(tv.getByTestId('camera-view')).toHaveAttribute('data-camera-state', 'live')
    await expect(operatorWindow.getByTestId('camera-status')).toContainText('Câmera ao vivo')
    await expect(operatorWindow.getByTestId('camera-status')).toContainText('640 × 360')

    const points: Array<[number, number]> = [
      [0.5, 0.06], // top center: the sensor's left edge
      [0.08, 0.5], // left middle: the middle of the sensor's top edge
      [0.92, 0.5], // right middle: gray (blue here would mean no mirror)
      [0.5, 0.94], // bottom center: gray (red here would mean upside down)
      [0.5, 0.5],
    ]
    await expect
      .poll(async () => {
        const [top, left, right, bottom, center] = await sampleCanvas(tv, points)
        return closeTo(top, RED) && closeTo(left, BLUE) && closeTo(right, GRAY) && closeTo(bottom, GRAY) && closeTo(center, GRAY)
      }, { timeout: 10_000 })
      .toBe(true)
  })
})
