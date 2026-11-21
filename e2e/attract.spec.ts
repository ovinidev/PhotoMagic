import type { Page } from '@playwright/test'
import { expect, test } from './fixtures'
import { PRINT_TIMEOUT, startEvent, takePhotos } from './event'

/** The attract screen's idle time (`ATTRACT_IDLE_MS`), skipped with Playwright's fake clock. */
const IDLE_MS = 45_000

/** Fakes the TV's timers from now on and touches the screen, so the idle count restarts on the fake clock. */
async function fakeIdleClock(tv: Page): Promise<void> {
  await tv.clock.install()
  await tv.evaluate(() => window.dispatchEvent(new Event('pointerdown')))
}

async function goIdle(tv: Page): Promise<void> {
  await tv.clock.fastForward(IDLE_MS)
}

test.describe('attract screen', () => {
  test('DESIGN §14 an idle fresh round shows the brand art and a tap returns to the camera', async ({ app, operatorWindow }) => {
    const tv = await startEvent(app, operatorWindow, { name: 'Festa', template: null })
    await fakeIdleClock(tv)
    await expect(tv.getByTestId('attract-screen')).toHaveCount(0)
    await goIdle(tv)
    const attract = tv.getByRole('button', { name: 'Toque para começar' })
    await expect(attract).toBeVisible()
    await expect(tv.getByTestId('attract-brand')).toBeVisible()
    expect(await tv.getByTestId('attract-cta').evaluate((node) => getComputedStyle(node).animationName)).toBe('none')

    await attract.click()
    await expect(tv.getByTestId('attract-screen')).toHaveCount(0)
    // The round is untouched: the camera is live and still at 1/3.
    await expect(tv.getByTestId('camera-view')).toHaveAttribute('data-camera-state', 'live')
    await expect(tv.getByTestId('photo-counter')).toHaveText('1/3')
  })

  test('DESIGN §14 after a print the attract screen shows the event montage', async ({ app, operatorWindow }) => {
    const tv = await startEvent(app, operatorWindow, { name: 'Festa', template: null })
    await takePhotos(tv, 3)
    await tv.getByRole('button', { name: 'Imprimir' }).click()
    await expect(tv.getByTestId('print-screen')).toHaveAttribute('data-phase', 'printed', { timeout: PRINT_TIMEOUT })
    await tv.getByRole('button', { name: 'Nova rodada' }).click()
    await expect(tv.getByTestId('photo-counter')).toHaveText('1/3')

    await fakeIdleClock(tv)
    await goIdle(tv)
    await expect(tv.getByTestId('attract-screen')).toBeVisible()
    await expect(tv.getByTestId('attract-slide')).toHaveCount(1)
    await expect(tv.getByAltText('Montagem recente do evento')).toBeVisible()
  })

  test('DESIGN §14 a round in progress never shows the attract screen', async ({ app, operatorWindow }) => {
    const tv = await startEvent(app, operatorWindow, { name: 'Festa', template: null })
    await takePhotos(tv, 1)
    await fakeIdleClock(tv)
    await goIdle(tv)
    await goIdle(tv)
    await expect(tv.getByTestId('attract-screen')).toHaveCount(0)
  })
})
