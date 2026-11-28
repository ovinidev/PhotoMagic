import type { WebContents } from 'electron'
import { IPC_CHANNELS, type PrinterStatus } from '@shared/ipc'
import type { PrinterSettings } from '@shared/printerSettings'
import { savePrinterSettings } from '../persist'
import type { Printer, PrinterMonitor } from '../print'
import { broadcast, handleInvoke } from './handle'

export type PrinterSettingsStore = { get: () => PrinterSettings; set: (next: PrinterSettings) => void }

/**
 * `printer:*` (DESIGN §4, §10): a fresh status read (changes are pushed with
 * `printer:status-changed`), the printer screen's settings, and a read of the queue and its saved
 * Windows preferences that changes nothing. Only the laptop saves the settings.
 */
export function registerPrinterHandlers(deps: {
  printerMonitor: PrinterMonitor
  printer: Printer
  printerSettings: PrinterSettingsStore
  userData: string
  isGuestWindow: (contents: WebContents) => boolean
}): void {
  handleInvoke(IPC_CHANNELS.printerStatus, () => deps.printerMonitor.refresh())
  handleInvoke(IPC_CHANNELS.printerGetSettings, () => deps.printerSettings.get())
  handleInvoke(IPC_CHANNELS.printerSaveSettings, async (settings, event) => {
    if (deps.isGuestWindow(event.sender)) return deps.printerSettings.get()
    await savePrinterSettings(deps.userData, settings)
    deps.printerSettings.set(settings)
    return settings
  })
  handleInvoke(IPC_CHANNELS.printerInspect, () => deps.printer.inspect())
}

/** Pushes every printer status change to both windows. */
export function broadcastPrinterStatus(status: PrinterStatus): void {
  broadcast(IPC_CHANNELS.printerStatusChanged, status)
}
