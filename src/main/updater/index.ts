import { app, net } from 'electron'
import { autoUpdater } from 'electron-updater'
import type { UpdateStatus } from '@shared/ipc'
import type { RuntimeFlags } from '@shared/runtime'
import { createUpdaterLogger } from './log'
import { nextUpdateStatus, shouldCheckForUpdates, type UpdaterEvent } from './policy'

export type Updater = {
  /** What the laptop shows: `idle`, a download in progress, or an update waiting for the next quit. */
  status: () => UpdateStatus
  /**
   * The startup check through the GitHub provider (`publish` in electron-builder.yml). Runs only
   * when `shouldCheckForUpdates` allows; never awaited, never throws, never blocks startup.
   */
  checkOnStartup: (state: { isEventOpen: () => boolean }) => void
}

/**
 * Background auto-update (DESIGN §11). The download happens in the background and the installer
 * runs when the app quits, so it never interrupts an event. Errors go to `logs/updater.log`.
 */
export function createUpdater({
  flags,
  userData,
  onChange,
}: {
  flags: RuntimeFlags
  userData: string
  onChange: (status: UpdateStatus) => void
}): Updater {
  let current: UpdateStatus = { kind: 'idle' }
  let started = false

  const apply = (event: UpdaterEvent) => {
    const next = nextUpdateStatus(current, event)
    if (next === current) return
    current = next
    onChange(current)
  }

  return {
    status: () => current,
    checkOnStartup: ({ isEventOpen }) => {
      if (started) return
      const online = net.isOnline()
      if (!shouldCheckForUpdates({ packaged: app.isPackaged, e2e: flags.e2e, eventOpen: isEventOpen(), online })) return
      started = true

      const logger = createUpdaterLogger(userData)
      autoUpdater.logger = logger
      autoUpdater.autoDownload = true
      // Never `quitAndInstall` and never ask "restart now?": the operator may be mid-event. The quit
      // that ends the night installs it silently and the next launch is the new version.
      autoUpdater.autoInstallOnAppQuit = true

      autoUpdater.on('update-available', (info) => apply({ kind: 'available', version: info.version }))
      autoUpdater.on('download-progress', (progress) => apply({ kind: 'progress', percent: progress.percent }))
      autoUpdater.on('update-downloaded', (info) => apply({ kind: 'downloaded', version: info.version }))
      autoUpdater.on('update-not-available', () => apply({ kind: 'not-available' }))
      // Losing the network mid-download is normal at an event: log it, show nothing.
      autoUpdater.on('error', (error) => {
        logger.error(error)
        apply({ kind: 'error' })
      })
      autoUpdater.checkForUpdates().catch((error: unknown) => {
        logger.error(error)
        apply({ kind: 'error' })
      })
    },
  }
}
