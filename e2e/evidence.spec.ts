import { execFileSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import type { ElectronApplication, Page } from '@playwright/test'
import { expect, test } from './fixtures'
import { PRINT_TIMEOUT, startEvent, takePhotos } from './event'
import { enableShare } from './share'

/**
 * PR evidence video, not a check. Excluded from `pnpm test:e2e` by `playwright.config.ts`; run it with
 * `FOTOMAGICA_EVIDENCE=<output.webm> pnpm exec playwright test e2e/evidence.spec.ts` (needs `ffmpeg`).
 * It drives the built app in the CI simulated camera and printer mode and films the TV window.
 * Run it with `FOTOMAGICA_EVIDENCE=/workspace/photomagic-verify/feat-qr-local-download.webm`; it also
 * writes the PR screenshots `docs/assets/pr/feat-qr-local-download-*.png`.
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

/** Where the PR screenshots go (`docs/assets/pr/feat-qr-local-download-*.png`). */
const SHOTS = join(__dirname, '..', 'docs', 'assets', 'pr', 'feat-qr-local-download')

test('evidence: after Imprimir the TV shows the Wi-Fi QR and the photo link QR', async ({ app, operatorWindow }) => {
  test.skip(!OUTPUT, 'set FOTOMAGICA_EVIDENCE to the output .webm path')
  test.setTimeout(120_000)
  await enableShare(operatorWindow, { ssid: 'FotoMagica', password: 'festa2026' })
  await operatorWindow.getByTestId('share-settings').screenshot({ path: `${SHOTS}-settings.png` })
  const tv = await startEvent(app, operatorWindow, { name: 'Festa' })
  await takePhotos(tv, 3)
  await expect(tv.getByTestId('print-preview')).toBeVisible()

  const stop = await film(app, tv)
  await tv.waitForTimeout(800)
  await tv.getByRole('button', { name: 'Imprimir' }).click()
  await expect(tv.getByTestId('print-screen')).toHaveAttribute('data-phase', 'printed', { timeout: PRINT_TIMEOUT })
  await expect(tv.getByTestId('share-qr-link').locator('img')).toBeVisible()
  await expect(tv.getByTestId('share-qr-wifi').locator('img')).toBeVisible()
  await tv.waitForTimeout(3_000)
  await tv.screenshot({ path: `${SHOTS}-tv.png` })
  await tv.waitForTimeout(800)
  await stop(OUTPUT)
})
