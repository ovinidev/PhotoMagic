import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { test as base, _electron as electron, type ElectronApplication, type Page } from '@playwright/test'

// The project root, not out/main/index.js: Electron then reads package.json (`main`, `version`, name).
const APP_ROOT = resolve(__dirname, '..')

/** Title of the TV window (`src/renderer/guest.html`). */
export const TV_TITLE = 'Foto Mágica — TV'

type Options = {
  /** Extra `FOTOMAGICA_*` variables for this test, e.g. `FOTOMAGICA_DISPLAYS` or `FOTOMAGICA_FAKE_CAMERA`. */
  appEnv: Record<string, string>
}

/** Per-test folders that replace Electron's `userData` and the Desktop (`FOTOMAGICA_USER_DATA`, `FOTOMAGICA_DESKTOP`). */
export type AppDirs = { userData: string; desktop: string }

type Fixtures = {
  dirs: AppDirs
  app: ElectronApplication
  operatorWindow: Page
}

/**
 * Launches the built app with the E2E contract: no webcam (Chromium's fake device), no second
 * physical monitor (a fixture list), no DS-RX1, no auto-update, and per-test userData and Desktop folders.
 * On Linux CI, Chromium's setuid sandbox helper is not installed, so the process-level sandbox is
 * disabled there; the renderer keeps `sandbox: true` in webPreferences.
 * The empty `{}` is how Playwright declares a fixture with no dependencies.
 */
export const test = base.extend<Options & Fixtures>({
  appEnv: [{}, { option: true }],
  dirs: async ({}, provide) => {
    const root = mkdtempSync(join(tmpdir(), 'fotomagica-e2e-'))
    await provide({ userData: join(root, 'userData'), desktop: join(root, 'Desktop') })
  },
  app: async ({ appEnv, dirs }, provide) => {
    const app = await electron.launch({
      args: [...(process.platform === 'linux' ? ['--no-sandbox'] : []), APP_ROOT],
      env: {
        ...process.env,
        FOTOMAGICA_E2E: '1',
        FOTOMAGICA_PRINTER: 'simulated',
        FOTOMAGICA_USER_DATA: dirs.userData,
        FOTOMAGICA_DESKTOP: dirs.desktop,
        ...appEnv,
      },
    })
    await provide(app)
    await app.close()
  },
  operatorWindow: async ({ app }, provide) => {
    const window = await app.firstWindow()
    await window.waitForLoadState('domcontentloaded')
    await provide(window)
  },
})

export { expect } from '@playwright/test'
