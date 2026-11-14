import { app } from 'electron'
import { autoUpdater } from 'electron-updater'
import type { RuntimeFlags } from '@shared/runtime'
import { shouldCheckForUpdates } from './policy'

/**
 * Starts a background update check through the GitHub provider (`publish` in electron-builder.yml).
 * It never blocks startup and never surfaces a network error: the party has no internet.
 * A downloaded update installs when the app quits.
 */
export function scheduleUpdateCheck({ flags, isEventOpen }: { flags: RuntimeFlags; isEventOpen: () => boolean }): void {
  if (!shouldCheckForUpdates({ packaged: app.isPackaged, e2e: flags.e2e, eventOpen: isEventOpen() })) return

  autoUpdater.autoDownload = true
  autoUpdater.autoInstallOnAppQuit = true
  // Offline is the normal case at an event; an update failure must never reach the operator.
  autoUpdater.on('error', () => {})
  autoUpdater.checkForUpdates().catch(() => {})
}
