import { BrowserWindow, screen } from 'electron'
import appIcon from '@brand/icon.png?asset'
import { centerIn } from '@shared/displays'
import { SECURE_WEB_PREFERENCES, loadRendererPage, lockNavigation } from './rendererEntry'

/** Small enough for a 1366×768 laptop screen, where the window must fit above the taskbar. */
const MIN_WIDTH = 1024
const MIN_HEIGHT = 640
const START = { width: 1280, height: 800 }

/**
 * The laptop window: framed, centered on the primary monitor, 1280×800 or the work area if smaller,
 * and maximized when the screen is at least 1366 px wide, so the UI scales with it (DESIGN §3).
 */
export function createOperatorWindow({ fitToScreen }: { fitToScreen: boolean }): BrowserWindow {
  const workArea = screen.getPrimaryDisplay().workArea
  // E2E keeps a fixed 1280×800 whatever the virtual screen, so specs see the same layout everywhere.
  const size = fitToScreen ? { width: Math.min(START.width, workArea.width), height: Math.min(START.height, workArea.height) } : START
  const window = new BrowserWindow({
    ...size,
    ...centerIn(workArea, size),
    minWidth: MIN_WIDTH,
    minHeight: MIN_HEIGHT,
    show: false,
    title: 'Foto Mágica',
    backgroundColor: '#F4F1EB',
    // The symbol on its light tile (RNF12): taskbar and title bar in dev too; the installer embeds icon.ico.
    icon: appIcon,
    webPreferences: SECURE_WEB_PREFERENCES,
  })

  // No menu bar: with the default menu, releasing Alt (the editor's "snap off" key) would reveal it
  // and push the editor down in the middle of a gesture (DESIGN §7).
  window.removeMenu()
  lockNavigation(window)
  window.once('ready-to-show', () => {
    if (fitToScreen && workArea.width >= 1366) window.maximize()
    window.show()
  })
  void loadRendererPage(window, 'operator')
  return window
}
