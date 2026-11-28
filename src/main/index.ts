import { networkInterfaces } from 'node:os'
import { app, BrowserWindow, type WebContents } from 'electron'
import type { DisplayFixture, SimulatedPrinterFlags } from '@shared/runtime'
import { readRuntimeFlags } from '@shared/runtime'
import { renderSheet } from './compose/renderSheet'
import { broadcastGalleryChanged, broadcastPrinterStatus, broadcastSession, broadcastShareState, broadcastUpdateStatus, broadcastZoomState, registerIpcHandlers } from './ipc'
import { applyCameraFixture, restrictPermissions } from './media'
import { createPrinter, createPrinterMonitor, withPrinterSettings, type Printer } from './print'
import { readConfig } from './persist'
import { createSession, saveMontage } from './session'
import { createShareService } from './share'
import { createUpdater } from './updater'
import {
  createFixtureDisplaySource,
  createGuestWindow,
  createGuestWindowController,
  createOperatorWindow,
  createOperatorZoom,
  createScreenDisplaySource,
  type DisplaySource,
} from './windows'

const flags = readRuntimeFlags(process.env)

/**
 * Test hook, only under E2E, through `app.evaluate`: Playwright plugs, unplugs or rotates the
 * fixture TV, and changes what the simulated printer reports (paper back in before a retry).
 */
declare global {
  var __fotomagicaE2E:
    | { setDisplays: (fixture: DisplayFixture) => void; setPrinter: (next: Partial<SimulatedPrinterFlags>) => void }
    | undefined
}

// Chromium switches and the userData path must be set before `ready`.
applyCameraFixture(flags)
if (flags.e2e && flags.fixtures.paths.userData) app.setPath('userData', flags.fixtures.paths.userData)

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

  void app.whenReady().then(async () => {
    app.setAppUserModelId('com.fotomagica.desktop')

    const userData = app.getPath('userData')
    // Offline photo download over the event Wi-Fi (DESIGN §17); off until the operator turns it on.
    const share = createShareService({
      settings: (await readConfig(userData)).share,
      interfaces: networkInterfaces,
      onChange: broadcastShareState,
      log: (message, error) => console.warn(`[share] ${message}`, error),
    })
    void share.start()
    app.on('will-quit', () => void share.stop())
    const printerHandle = createPrinter(flags, userData)
    const printerMonitor = createPrinterMonitor({ printer: printerHandle.printer, intervalMs: printerHandle.pollMs, onChange: broadcastPrinterStatus })
    // The operator's printer screen: the cut per mode and whether the Windows preferences go back.
    let printerSettings = (await readConfig(userData)).printer
    // After every send the line on both screens shows what the spooler says now, not 5 s later.
    const configured = withPrinterSettings(printerHandle.printer, () => printerSettings)
    const printer: Printer = {
      status: printerMonitor.refresh,
      inspect: configured.inspect,
      print: async (ticket) => {
        const result = await configured.print(ticket)
        void printerMonitor.refresh()
        return result
      },
    }
    app.on('will-quit', () => {
      printerMonitor.stop()
      printerHandle.dispose()
    })

    let displays: DisplaySource
    if (flags.e2e) {
      const fixture = createFixtureDisplaySource(flags.fixtures.displays)
      globalThis.__fotomagicaE2E = {
        setDisplays: fixture.set,
        setPrinter: (next) => {
          printerHandle.setSimulated?.(next)
          void printerMonitor.refresh()
        },
      }
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

    const desktop = (flags.e2e && flags.fixtures.paths.desktop) || app.getPath('desktop')
    const session = createSession({
      render: renderSheet,
      saveMontage: async (folder, jpeg) => {
        const saved = await saveMontage(folder, jpeg)
        broadcastGalleryChanged()
        share.publish(saved)
        return saved
      },
      printer,
      onChange: (state) => {
        // The link belongs to one round: a fresh round takes it off the screens, the event's end revokes them all.
        // The event gallery link lives as long as the event (DESIGN §17).
        if (state.kind === 'idle') share.endEvent()
        else {
          const open = session.openEvent()
          if (open) share.openEvent(open)
          if (state.phase.kind === 'capturing') share.endRound()
        }
        broadcastSession(state)
      },
      onError: (error) => console.error('[session] preview failed', error),
    })

    const updater = createUpdater({ flags, userData, onChange: broadcastUpdateStatus })
    // Laptop window only: the automatic factor for its size times the operator's saved zoom.
    const zoom = createOperatorZoom({ userData, onChange: broadcastZoomState })

    restrictPermissions(isGuestWindow)
    registerIpcHandlers({
      flags,
      tv,
      session,
      printerMonitor,
      printer,
      printerSettings: {
        get: () => printerSettings,
        set: (next) => {
          printerSettings = next
        },
      },
      updateStatus: updater.status,
      zoom,
      share,
      userData,
      desktop,
      isGuestWindow,
      guestContents: () => (guestContents && !guestContents.isDestroyed() ? guestContents : null),
    })

    operatorWindow = createOperatorWindow({ fitToScreen: !flags.e2e })
    zoom.attach(operatorWindow)
    operatorWindow.on('closed', () => {
      operatorWindow = null
      // The TV never outlives the laptop window: closing it ends the app.
      tv.close()
    })

    // The check runs only with no event open and a network (DESIGN §11); it never holds up startup.
    updater.checkOnStartup({ isEventOpen: session.isOpen })
  })
}
