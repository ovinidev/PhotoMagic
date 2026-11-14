import { app, BrowserWindow, type Rectangle } from 'electron'
import { SECURE_WEB_PREFERENCES, loadRendererPage, lockNavigation } from './rendererEntry'

/**
 * The TV camera window: frameless, covering the bounds of the monitor chosen by the pure
 * display function (DESIGN §3). Placeholder until events exist: nothing opens it yet.
 * It ignores accidental close; only `closeGuestWindow` (Encerrar evento, app quit) destroys it.
 */
export function createGuestWindow(bounds: Rectangle): BrowserWindow {
  const window = new BrowserWindow({
    ...bounds,
    frame: false,
    fullscreen: true,
    show: false,
    resizable: false,
    movable: false,
    minimizable: false,
    skipTaskbar: true,
    backgroundColor: '#000000',
    title: 'Foto Mágica — TV',
    webPreferences: SECURE_WEB_PREFERENCES,
  })

  window.on('close', (event) => event.preventDefault())
  // The guard above would otherwise cancel quitting the app.
  const destroyOnQuit = () => closeGuestWindow(window)
  app.once('before-quit', destroyOnQuit)
  window.once('closed', () => app.off('before-quit', destroyOnQuit))
  lockNavigation(window)
  window.once('ready-to-show', () => window.show())
  void loadRendererPage(window, 'guest')
  return window
}

/** Closes the TV window for real, bypassing the accidental-close guard. */
export function closeGuestWindow(window: BrowserWindow): void {
  if (!window.isDestroyed()) window.destroy()
}
