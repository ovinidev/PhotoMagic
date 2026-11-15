import { app, BrowserWindow, type WebContents } from 'electron'
import type { DisplayFixture } from '@shared/runtime'
import { readRuntimeFlags } from '@shared/runtime'
import { registerIpcHandlers } from './ipc'
import { applyCameraFixture, restrictPermissions } from './media'
import { scheduleUpdateCheck } from './updater'
import {
  createFixtureDisplaySource,
  createGuestWindow,
  createGuestWindowController,
  createOperatorWindow,
  createScreenDisplaySource,
  type DisplaySource,
} from './windows'

const flags = readRuntimeFlags(process.env)

/** Test hook, only under E2E: Playwright plugs, unplugs or rotates the fixture TV through `app.evaluate`. */
declare global {
  var __fotomagicaE2E: { setDisplays: (fixture: DisplayFixture) => void } | undefined
}

// Chromium switches must be set before `ready`.
applyCameraFixture(flags)

// One photobooth per laptop: a second launch focuses the window that is already open.
if (!app.requestSingleInstanceLock()) {
  app.quit()
} else {
  let operatorWindow: BrowserWindow | null = null
  let guestContents: WebContents | null = null
  const isGuestWindow = (contents: WebContents | null) =>
    contents !== null && guestContents !== null && !guestContents.isDestroyed() && contents === guestContents

  app.on('second-instance', () => {
    if (!operatorWindow) return
    if (operatorWindow.isMinimized()) operatorWindow.restore()
    operatorWindow.focus()
  })

  app.on('window-all-closed', () => {
    app.quit()
  })

  void app.whenReady().then(() => {
    app.setAppUserModelId('com.fotomagica.desktop')

    let displays: DisplaySource
    if (flags.e2e) {
      const fixture = createFixtureDisplaySource(flags.fixtures.displays)
      globalThis.__fotomagicaE2E = { setDisplays: fixture.set }
      displays = fixture
    } else {
      displays = createScreenDisplaySource()
    }

    const tv = createGuestWindowController({
      displays,
      createWindow: () => {
        const guest = createGuestWindow({ fullscreen: !flags.e2e })
        guestContents = guest.window.webContents
        return guest
      },
    })

    restrictPermissions(isGuestWindow)
    registerIpcHandlers({ flags, tv, isGuestWindow })

    operatorWindow = createOperatorWindow()
    operatorWindow.on('closed', () => {
      operatorWindow = null
      // The TV never outlives the laptop window: closing it ends the app.
      tv.close()
    })

    // No event can be open yet at startup; the getter is the hook for when events exist.
    scheduleUpdateCheck({ flags, isEventOpen: () => false })
  })
}
