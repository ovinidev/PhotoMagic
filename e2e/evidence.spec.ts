import { execFileSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import type { ElectronApplication, Page } from '@playwright/test'
import { test } from './fixtures'
import { startEvent, takePhotos } from './event'

/**
 * PR evidence video, not a check. Excluded from `pnpm test:e2e` by `playwright.config.ts`; run it with
 * `FOTOMAGICA_EVIDENCE=<output.webm> pnpm exec playwright test e2e/evidence.spec.ts` (needs `ffmpeg`).
 * It drives the built app in the CI simulated camera and printer mode and films the TV window.
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

test('evidence: a capture round on the TV, forward to print and back', async ({ app, operatorWindow }) => {
  test.skip(!OUTPUT, 'set FOTOMAGICA_EVIDENCE to the output .webm path')
  test.setTimeout(90_000)
  const tv = await startEvent(app, operatorWindow, { name: 'Festa' })
  const stop = await film(app, tv)
  await tv.waitForTimeout(800)
  await takePhotos(tv, 3)
  await tv.waitForTimeout(2_000)
  await tv.getByRole('button', { name: 'Cancelar' }).click()
  await tv.waitForTimeout(1_500)
  await stop(OUTPUT)
})
