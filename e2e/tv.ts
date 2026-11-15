import type { ElectronApplication, Page } from '@playwright/test'
import { TV_TITLE } from './fixtures'

export type WindowInfo = { title: string; visible: boolean; bounds: { x: number; y: number; width: number; height: number } }

/** Every BrowserWindow as main sees it. */
export function listWindows(app: ElectronApplication): Promise<WindowInfo[]> {
  return app.evaluate(({ BrowserWindow }) =>
    BrowserWindow.getAllWindows().map((window) => ({
      title: window.getTitle(),
      visible: window.isVisible(),
      bounds: window.getBounds(),
    })),
  )
}

/** Clicks `Abrir câmera na TV` (or the landscape confirmation) and returns the TV page. */
export async function openTv(app: ElectronApplication, operatorWindow: Page, button = 'Abrir câmera na TV'): Promise<Page> {
  const opened = app.waitForEvent('window')
  await operatorWindow.getByRole('button', { name: button }).click()
  const tv = await opened
  await tv.waitForLoadState('domcontentloaded')
  return tv
}

/** Plugs, unplugs or rotates the fixture TV at runtime (test hook installed by main under E2E). */
export function setDisplays(app: ElectronApplication, fixture: 'portrait-tv' | 'landscape-tv' | 'laptop-only'): Promise<void> {
  return app.evaluate((_electron, next) => {
    const hook = (globalThis as { __fotomagicaE2E?: { setDisplays: (fixture: string) => void } }).__fotomagicaE2E
    if (!hook) throw new Error('E2E hook missing: is FOTOMAGICA_E2E=1 set?')
    hook.setDisplays(next)
  }, fixture)
}

export { TV_TITLE }
