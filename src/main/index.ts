import { app, BrowserWindow } from 'electron'
import { readRuntimeFlags } from '@shared/runtime'
import { registerIpcHandlers } from './ipc'
import { scheduleUpdateCheck } from './updater'
import { createOperatorWindow } from './windows'

const flags = readRuntimeFlags(process.env)

// One photobooth per laptop: a second launch focuses the window that is already open.
if (!app.requestSingleInstanceLock()) {
  app.quit()
} else {
  let operatorWindow: BrowserWindow | null = null

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
    registerIpcHandlers({ flags })

    operatorWindow = createOperatorWindow()
    operatorWindow.on('closed', () => {
      operatorWindow = null
    })

    // No event can be open yet at startup; the getter is the hook for when events exist.
    scheduleUpdateCheck({ flags, isEventOpen: () => false })
  })
}
