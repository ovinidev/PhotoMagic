import { execFileSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import type { ElectronApplication, Page } from '@playwright/test'
import { expect, test } from './fixtures'
import { PRINT_TIMEOUT, startEvent, takePhotos } from './event'

/** Mirrors `ATTRACT_IDLE_MS`, `ATTRACT_SLIDE_MS` and `ATTRACT_FADE_MS` in `features/attract/utils/slides.ts`. */
const ATTRACT_IDLE_MS = 45_000
const ATTRACT_SLIDE_MS = 6_000
const ATTRACT_FADE_MS = 1_200

/**
 * PR evidence video, not a check. Excluded from `pnpm test:e2e` by `playwright.config.ts`; run it with
 * `FOTOMAGICA_EVIDENCE=<output.webm> pnpm exec playwright test e2e/evidence.spec.ts` (needs `ffmpeg`).
 * It drives the built app in the CI simulated camera and printer mode and films the TV window.
 * Run it with `FOTOMAGICA_EVIDENCE=/workspace/photomagic-verify/feat-attract-screen.webm`; it also
 * writes the PR screenshots `docs/assets/pr/feat-attract-screen-*.png`.
 * Playwright's `recordVideo` stalls Electron windows created with `show: false`, so the frames come
 * from a CDP screencast and ffmpeg encodes them with their real timing.
 */
const OUTPUT = process.env['FOTOMAGICA_EVIDENCE'] ?? ''

type Frame = { file: string; at: number }

async function film(app: ElectronApplication, page: Page) {
  const dir = mkdtempSync(join(tmpdir(), 'fotomagica-evidence-'))
  const frames: Frame[] = []
  const cdp = await app.context().newCDPSession(page)
  cdp.on('Page.screencastFrame', (frame) => {
    const file = join(dir, `${String(frames.length).padStart(5, '0')}.jpg`)
    writeFileSync(file, Buffer.from(frame.data, 'base64'))
    frames.push({ file, at: frame.metadata.timestamp ?? Date.now() / 1000 })
    void cdp.send('Page.screencastFrameAck', { sessionId: frame.sessionId }).catch(() => {})
  })
  await cdp.send('Page.startScreencast', { format: 'jpeg', quality: 85, maxWidth: 1080, maxHeight: 1920, everyNthFrame: 1 })
  return async (output: string) => {
    await cdp.send('Page.stopScreencast')
    const lines = frames.flatMap((frame, index) => {
      const next = frames[index + 1]?.at ?? frame.at + 0.5
      return [`file '${frame.file}'`, `duration ${Math.max(next - frame.at, 0.001).toFixed(3)}`]
    })
    lines.push(`file '${frames.at(-1)?.file}'`)
    const list = join(dir, 'frames.txt')
    writeFileSync(list, lines.join('\n'))
    mkdirSync(dirname(output), { recursive: true })
    const scale = 'scale=540:960:force_original_aspect_ratio=decrease,pad=540:960:(ow-iw)/2:(oh-ih)/2'
    execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'concat', '-safe', '0', '-i', list, '-vf', `${scale},fps=30`, '-c:v', 'libvpx-vp9', '-b:v', '2M', output])
  }
}

/** Where the PR screenshots go (`docs/assets/pr/feat-attract-screen-*.png`). */
const SHOTS = join(__dirname, '..', 'docs', 'assets', 'pr', 'feat-attract-screen')

/** One full round to `Imprimir`, then `Nova rodada`: a montage lands in the event gallery. */
async function printRound(tv: Page): Promise<void> {
  await takePhotos(tv, 3)
  await tv.getByRole('button', { name: 'Imprimir' }).click()
  await expect(tv.getByTestId('print-screen')).toHaveAttribute('data-phase', 'printed', { timeout: PRINT_TIMEOUT })
  await tv.getByRole('button', { name: 'Nova rodada' }).click()
  await expect(tv.getByTestId('photo-counter')).toHaveText('1/3')
}

test('evidence: the TV attract screen cycles the event montages and a tap returns to the camera', async ({ app, operatorWindow }) => {
  test.skip(!OUTPUT, 'set FOTOMAGICA_EVIDENCE to the output .webm path')
  test.setTimeout(120_000)
  const tv = await startEvent(app, operatorWindow, { name: 'Festa' })
  await printRound(tv)
  await tv.waitForTimeout(1_500)
  await printRound(tv)

  const stop = await film(app, tv)
  await tv.waitForTimeout(800)
  // Skip the 45 s idle on a fake clock, then let time run for real so the crossfade plays.
  await tv.clock.install()
  await tv.evaluate(() => window.dispatchEvent(new Event('pointerdown')))
  await tv.clock.fastForward(ATTRACT_IDLE_MS)
  await tv.clock.resume()
  await expect(tv.getByTestId('attract-slide').first()).toBeVisible()
  await tv.waitForTimeout(1_500)
  await tv.screenshot({ path: `${SHOTS}-carousel.png` })
  await tv.waitForTimeout(ATTRACT_SLIDE_MS + ATTRACT_FADE_MS)
  await tv.getByRole('button', { name: 'Toque para começar' }).click()
  await expect(tv.getByTestId('attract-screen')).toHaveCount(0)
  await tv.waitForTimeout(1_200)
  await stop(OUTPUT)

  // Reduced motion: the newest montage, still, with a steady call to action.
  await tv.emulateMedia({ reducedMotion: 'reduce' })
  await tv.evaluate(() => window.dispatchEvent(new Event('pointerdown')))
  await tv.clock.fastForward(ATTRACT_IDLE_MS)
  await expect(tv.getByTestId('attract-screen')).toHaveAttribute('data-motion', 'reduced')
  await tv.waitForTimeout(800)
  await tv.screenshot({ path: `${SHOTS}-reduced-motion.png` })
})
