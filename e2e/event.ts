import { mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { ElectronApplication, Page } from '@playwright/test'
import sharp from 'sharp'
import { expect } from './fixtures'

const dir = mkdtempSync(join(tmpdir(), 'fotomagica-templates-'))

/** Writes a solid-color PNG of the given size and returns its path. */
export async function writePng(name: string, size: { width: number; height: number }, color = '#808080'): Promise<string> {
  const path = join(dir, name)
  writeFileSync(path, await sharp({ create: { ...size, channels: 3, background: color } }).png().toBuffer())
  return path
}

/** A valid 1844×1240 template. */
export const validTemplate = () => writePng('template-1844x1240.png', { width: 1844, height: 1240 })

const MODE_LABEL = { 'two-strips': '2 tiras', 'one-strip': '1 tira' } as const

/** Fills the create-event form: name, mode and that mode's template. */
export async function fillEvent(operatorWindow: Page, options: { name: string; mode?: keyof typeof MODE_LABEL; template?: string }) {
  const mode = options.mode ?? 'two-strips'
  await operatorWindow.getByLabel('Nome do evento').fill(options.name)
  await operatorWindow.getByRole('radio', { name: new RegExp(MODE_LABEL[mode]) }).check()
  await operatorWindow.getByTestId('template-input').setInputFiles(options.template ?? (await validTemplate()))
  // An accepted template opens the slot editor over the form; a rejected one shows why.
  const editor = layoutEditor(operatorWindow)
  await expect(editor.or(operatorWindow.getByRole('alert')).first()).toBeVisible()
  if (await editor.isVisible()) await closeLayoutEditor(operatorWindow)
}

/** The slot editor dialog (PRD §6.2). */
export const layoutEditor = (operatorWindow: Page) => operatorWindow.getByRole('dialog', { name: 'Posições das fotos' })

/** `Concluir`: every change is already saved, this only closes the editor. */
export async function closeLayoutEditor(operatorWindow: Page): Promise<void> {
  const editor = layoutEditor(operatorWindow)
  await editor.getByRole('button', { name: 'Concluir' }).click()
  await expect(editor).toBeHidden()
}

/** Fills the form, clicks `Iniciar evento` and returns the TV page, live and at 1/3. */
export async function startEvent(app: ElectronApplication, operatorWindow: Page, options: Parameters<typeof fillEvent>[1]): Promise<Page> {
  await fillEvent(operatorWindow, options)
  await expect(operatorWindow.getByTestId('template-preview')).toBeVisible()
  const opened = app.waitForEvent('window')
  await operatorWindow.getByRole('button', { name: 'Iniciar evento' }).click()
  const tv = await opened
  await tv.waitForLoadState('domcontentloaded')
  await expect(tv.getByTestId('camera-view')).toHaveAttribute('data-camera-state', 'live')
  await expect(tv.getByTestId('photo-counter')).toHaveText('1/3')
  return tv
}

/**
 * One capture at the 1920×1080 request: under xvfb the canvas JPEG encode runs in software, so
 * leave headroom above the default 5 s for a loaded runner.
 */
export const PHOTO_TIMEOUT = 8_000

/** Taps the white button `count` times with the timer off, waiting for each photo to count. */
export async function takePhotos(tv: Page, count: number): Promise<void> {
  for (let photo = 1; photo <= count; photo++) {
    await tv.getByRole('button', { name: 'Tirar foto' }).click()
    if (photo < 3) await expect(tv.getByTestId('photo-counter')).toHaveText(`${photo + 1}/3`, { timeout: PHOTO_TIMEOUT })
  }
  if (count === 3) await expect(tv.getByTestId('print-screen')).toBeVisible({ timeout: PHOTO_TIMEOUT })
}

/** The simulated tickets written so far, oldest first. */
export async function simulatedTickets(userData: string): Promise<Array<{ jpegPath: string; copies: number; mode: string; cut: boolean }>> {
  const { readdir, readFile } = await import('node:fs/promises')
  const folder = join(userData, 'simulated-prints')
  const names = (await readdir(folder).catch(() => [] as string[])).filter((name) => name.endsWith('.json')).sort()
  return Promise.all(names.map(async (name) => JSON.parse(await readFile(join(folder, name), 'utf8'))))
}
