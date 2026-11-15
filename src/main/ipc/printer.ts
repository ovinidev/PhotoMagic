import { IPC_CHANNELS, type PrinterStatus } from '@shared/ipc'
import type { PrinterMonitor } from '../print'
import { broadcast, handleInvoke } from './handle'

/** `printer:status` (DESIGN §4): a fresh read; changes are pushed with `printer:status-changed`. */
export function registerPrinterHandlers({ printerMonitor }: { printerMonitor: PrinterMonitor }): void {
  handleInvoke(IPC_CHANNELS.printerStatus, () => printerMonitor.refresh())
}

/** Pushes every printer status change to both windows. */
export function broadcastPrinterStatus(status: PrinterStatus): void {
  broadcast(IPC_CHANNELS.printerStatusChanged, status)
}
