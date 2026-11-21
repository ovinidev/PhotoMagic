import { mkdirSync } from 'node:fs'
import { dirname } from 'node:path'
import { expect, test } from './fixtures'
import { PRINT_TIMEOUT, setSimulatedPrinter, startEvent, takePhotos } from './event'
import { enableShare } from './share'

/**
 * PR evidence screenshots, not a check. Excluded from `pnpm test:e2e` by `playwright.config.ts`; run it with
 * `FOTOMAGICA_EVIDENCE=/workspace/photomagic-verify/<branch> pnpm exec playwright test e2e/evidence.spec.ts`.
 * It drives the built app in the CI simulated camera and printer mode and saves one PNG per main screen,
 * at the window's own size, as `<prefix>-<screen>.png`. No video.
 */
const PREFIX = process.env['FOTOMAGICA_EVIDENCE'] ?? ''

/** The attract screen's idle time (`ATTRACT_IDLE_MS`), skipped with Playwright's fake clock. */
const IDLE_MS = 45_000

/** How long the simulated printer holds the job, so the `Imprimindo…` line can be captured. */
const HOLD_MS = 2_000

test('evidence: screenshots of the home, attract, capture, review and print status screens', async ({ app, operatorWindow }) => {
  test.skip(!PREFIX, 'set FOTOMAGICA_EVIDENCE to the output path prefix')
  test.setTimeout(120_000)
  mkdirSync(dirname(PREFIX), { recursive: true })
  const shot = (page: Parameters<typeof startEvent>[1], name: string) => page.screenshot({ path: `${PREFIX}-${name}.png` })

  await shot(operatorWindow, 'home')
  await enableShare(operatorWindow)
  const tv = await startEvent(app, operatorWindow, { name: 'Festa', template: null })
  await setSimulatedPrinter(app, { delayMs: HOLD_MS })

  await tv.clock.install()
  await tv.evaluate(() => window.dispatchEvent(new Event('pointerdown')))
  await tv.clock.fastForward(IDLE_MS)
  const attract = tv.getByRole('button', { name: 'Toque para começar' })
  await expect(attract).toBeVisible()
  await shot(tv, 'attract')
  await attract.click()

  await expect(tv.getByTestId('camera-view')).toHaveAttribute('data-camera-state', 'live')
  await shot(tv, 'capture')
  await takePhotos(tv, 3)
  await expect(tv.getByTestId('print-preview')).toBeVisible()
  await shot(tv, 'review')
  await tv.getByRole('button', { name: 'Imprimir' }).click()
  await expect(tv.getByTestId('print-message')).toHaveText('Imprimindo…')
  await shot(tv, 'print-status')
  await expect(tv.getByTestId('print-message')).toHaveText('Sua foto está pronta!', { timeout: PRINT_TIMEOUT })
  await shot(tv, 'print-done')
  await expect(tv.getByTestId('share-qr-link').locator('img')).toBeVisible()
  await shot(tv, 'print-qr')
  await shot(operatorWindow, 'laptop-gallery-qr')
})
