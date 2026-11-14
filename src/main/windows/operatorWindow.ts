import { BrowserWindow } from 'electron'
import { SECURE_WEB_PREFERENCES, loadRendererPage, lockNavigation } from './rendererEntry'

const MIN_WIDTH = 1280
const MIN_HEIGHT = 800

/** The laptop window: framed, on the primary monitor, at least 1280×800 (DESIGN §3). */
export function createOperatorWindow(): BrowserWindow {
  const window = new BrowserWindow({
    width: MIN_WIDTH,
    height: MIN_HEIGHT,
    minWidth: MIN_WIDTH,
    minHeight: MIN_HEIGHT,
    show: false,
    title: 'Foto Mágica',
    backgroundColor: '#F4F1EB',
    autoHideMenuBar: true,
    webPreferences: SECURE_WEB_PREFERENCES,
  })

  lockNavigation(window)
  window.once('ready-to-show', () => window.show())
  void loadRendererPage(window, 'operator')
  return window
}
