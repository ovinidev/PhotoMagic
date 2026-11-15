import type { WebContents } from 'electron'
import type { RuntimeFlags } from '@shared/runtime'
import type { PrinterMonitor } from '../print'
import type { GuestWindowController } from '../windows'
import { registerAppHandlers } from './app'
import { registerCameraHandlers } from './camera'
import { registerDisplayHandlers } from './display'
import { registerEventHandlers, type EventDeps } from './event'
import { registerPrinterHandlers } from './printer'

export { broadcastSession } from './event'
export { broadcastPrinterStatus } from './printer'

/** One module per area; each registers its own channels. */
export function registerIpcHandlers(
  deps: {
    flags: RuntimeFlags
    tv: GuestWindowController
    isGuestWindow: (contents: WebContents) => boolean
    printerMonitor: PrinterMonitor
  } & EventDeps,
): void {
  registerAppHandlers(deps)
  registerDisplayHandlers(deps)
  registerCameraHandlers(deps)
  registerEventHandlers(deps)
  registerPrinterHandlers(deps)
}
