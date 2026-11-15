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
  /**
   * Closes the app and opens it again on the same userData and Desktop: a real restart. Returns the
   * new app and its laptop window; the `app` and `operatorWindow` fixtures keep pointing at the old one.
   */
  relaunch: () => Promise<{ app: ElectronApplication; operatorWindow: Page }>
}

type Internal = { launched: { current: ElectronApplication } }

function launchApp(dirs: AppDirs, appEnv: Record<string, string>): Promise<ElectronApplication> {
  return electron.launch({
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
}

async function firstWindow(app: ElectronApplication): Promise<Page> {
  const window = await app.firstWindow()
  await window.waitForLoadState('domcontentloaded')
  return window
}

/**
 * Launches the built app with the E2E contract: no webcam (Chromium's fake device), no second
 * physical monitor (a fixture list), no DS-RX1, no auto-update, and per-test userData and Desktop folders.
 * On Linux CI, Chromium's setuid sandbox helper is not installed, so the process-level sandbox is
 * disabled there; the renderer keeps `sandbox: true` in webPreferences.
 * The empty `{}` is how Playwright declares a fixture with no dependencies.
 */
export const test = base.extend<Options & Fixtures & Internal>({
  appEnv: [{}, { option: true }],
  dirs: async ({}, provide) => {
    const root = mkdtempSync(join(tmpdir(), 'fotomagica-e2e-'))
    await provide({ userData: join(root, 'userData'), desktop: join(root, 'Desktop') })
  },
  launched: async ({ appEnv, dirs }, provide) => {
    const launched = { current: await launchApp(dirs, appEnv) }
    await provide(launched)
    // Only the latest instance is still running; an earlier one was closed by `relaunch`.
    await launched.current.close()
  },
  app: async ({ launched }, provide) => {
    await provide(launched.current)
  },
  operatorWindow: async ({ app }, provide) => {
    await provide(await firstWindow(app))
  },
  relaunch: async ({ launched, appEnv, dirs }, provide) => {
    await provide(async () => {
      await launched.current.close()
      launched.current = await launchApp(dirs, appEnv)
      return { app: launched.current, operatorWindow: await firstWindow(launched.current) }
    })
  },
})

export { expect } from '@playwright/test'
