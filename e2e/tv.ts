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

/**
 * Where main placed the TV window, from `display:get-state`. The fixture monitors do not exist on
 * the X server, which may clamp the real window onto its own screen, so specs assert main's
 * decision here and only visibility on the BrowserWindow.
 */
export async function tvPlacement(operatorWindow: Page) {
  const { tv } = await operatorWindow.evaluate(() => window.fotomagica.display.getState())
  return tv.kind === 'open' ? { kind: tv.kind, bounds: { x: tv.display.x, y: tv.display.y, width: tv.display.width, height: tv.display.height } } : tv
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
