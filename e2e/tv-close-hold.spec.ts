import type { Page } from '@playwright/test'
import { expect, test } from './fixtures'
import { startEvent, takePhotos } from './event'
import { listWindows, TV_TITLE } from './tv'

/** Dispatches the touch list the TV sees: `points` fingers down (or none, all lifted). */
function touches(tv: Page, type: 'touchstart' | 'touchend', points: Array<{ x: number; y: number }>) {
  return tv.evaluate(
    ({ type, points }) => {
      const list = points.map(
        (point, index) => new Touch({ identifier: index, target: document.body, clientX: point.x, clientY: point.y }),
      )
      document.body.dispatchEvent(new TouchEvent(type, { bubbles: true, touches: list, changedTouches: list }))
    },
    { type, points },
  )
}

const tvVisible = async (app: Parameters<typeof listWindows>[0]) => (await listWindows(app)).find((window) => window.title === TV_TITLE)?.visible

test.describe('TV two-finger close hold (DESIGN §3)', () => {
  test('one finger never closes; two fingers held hide the TV, the round stays, and the laptop reopens it', async ({ app, operatorWindow }) => {
    const tv = await startEvent(app, operatorWindow, { name: 'Festa', template: null })
    await takePhotos(tv, 1)

    await touches(tv, 'touchstart', [{ x: 300, y: 900 }])
    await tv.waitForTimeout(2500)
    await touches(tv, 'touchend', [])
    expect(await tvVisible(app)).toBe(true)

    await touches(tv, 'touchstart', [{ x: 300, y: 900 }, { x: 700, y: 900 }])
    await expect(tv.getByTestId('close-hold-hint')).toBeVisible()
    await expect.poll(() => tvVisible(app), { timeout: 5_000 }).toBe(false)
    await touches(tv, 'touchend', [])

    const status = operatorWindow.getByTestId('tv-status')
    await expect(status).toContainText('Tela da TV fechada')
    // The event and its round are still open on the laptop.
    await expect(operatorWindow.getByRole('button', { name: 'Encerrar evento' })).toBeVisible()

    await status.getByRole('button', { name: 'Abrir TV' }).click()
    await expect.poll(() => tvVisible(app)).toBe(true)
    await expect(status).toContainText('Câmera aberta na TV')
    await expect(tv.getByTestId('photo-counter')).toHaveText('2/3')
  })
})
