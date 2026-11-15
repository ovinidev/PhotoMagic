import { BrowserWindow, screen } from 'electron'
import { centerIn } from '@shared/displays'
import { SECURE_WEB_PREFERENCES, loadRendererPage, lockNavigation } from './rendererEntry'

const MIN_WIDTH = 1280
const MIN_HEIGHT = 800

/** The laptop window: framed, centered on the primary monitor, at least 1280×800 (DESIGN §3). */
export function createOperatorWindow(): BrowserWindow {
  const size = { width: MIN_WIDTH, height: MIN_HEIGHT }
  const window = new BrowserWindow({
    ...size,
    ...centerIn(screen.getPrimaryDisplay().workArea, size),
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
