import { app, BrowserWindow } from 'electron'
import { tvZoomFactor, type DisplayInfo } from '@shared/displays'
import type { GuestWindowHandle } from './guestWindowController'
import { SECURE_WEB_PREFERENCES, loadRendererPage, lockNavigation } from './rendererEntry'

/**
 * The TV camera window: frameless, covering the bounds of the monitor chosen by the pure display
 * function (DESIGN §3), with the page zoomed so its 1080×1920 logical frame fits that monitor.
 * It ignores accidental close; only `destroy` (closing the TV from the laptop, app quit) removes it.
 *
 * `fullscreen` is off only under E2E, where the TV is a fixture monitor that does not exist on the
 * X server: fullscreen would snap the window to the real screen and hide the fixture bounds.
 */
export function createGuestWindow({ fullscreen }: { fullscreen: boolean }): GuestWindowHandle & { window: BrowserWindow } {
  const window = new BrowserWindow({
    frame: false,
    show: false,
    resizable: false,
    movable: false,
    minimizable: false,
    maximizable: false,
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

  let zoom = 1
  // Chromium resets the zoom when the page (re)loads.
  window.webContents.on('did-finish-load', () => {
    window.webContents.setZoomFactor(zoom)
    // Touch-safe TV: no pinch zoom. Ctrl + wheel never zooms in Electron without a handler.
    void window.webContents.setVisualZoomLevelLimits(1, 1).catch(() => {})
  })
  void loadRendererPage(window, 'guest')

  return {
    window,
    place: (display: DisplayInfo) => {
      if (window.isDestroyed()) return
      const bounds = { x: display.x, y: display.y, width: display.width, height: display.height }
      // Leave fullscreen first: Windows keeps a fullscreen window on its old monitor.
      if (window.isFullScreen()) window.setFullScreen(false)
      window.setBounds(bounds)
      zoom = tvZoomFactor(display)
      window.webContents.setZoomFactor(zoom)
      if (!window.isVisible()) window.show()
      if (fullscreen) window.setFullScreen(true)
    },
    hide: () => {
      if (window.isDestroyed()) return
      if (window.isFullScreen()) window.setFullScreen(false)
      window.hide()
    },
    destroy: () => closeGuestWindow(window),
    onClosed: (listener) => {
      window.once('closed', listener)
    },
  }
}

/** Closes the TV window for real, bypassing the accidental-close guard. */
export function closeGuestWindow(window: BrowserWindow): void {
  if (!window.isDestroyed()) window.destroy()
}
