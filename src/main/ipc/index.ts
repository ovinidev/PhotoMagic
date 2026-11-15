import type { WebContents } from 'electron'
import type { RuntimeFlags } from '@shared/runtime'
import type { Printer, PrinterMonitor } from '../print'
import type { GuestWindowController } from '../windows'
import { registerAppHandlers } from './app'
import { registerCameraHandlers } from './camera'
import { registerDisplayHandlers } from './display'
import { registerEventHandlers, type EventDeps } from './event'
import { registerGalleryHandlers } from './gallery'
import { registerPrinterHandlers } from './printer'
import { registerWebcamHandlers } from './webcam'

export { broadcastSession } from './event'
export { broadcastPrinterStatus } from './printer'
export { broadcastGalleryChanged } from './gallery'

/** One module per area; each registers its own channels. */
export function registerIpcHandlers(
  deps: {
    flags: RuntimeFlags
    tv: GuestWindowController
    isGuestWindow: (contents: WebContents) => boolean
    printerMonitor: PrinterMonitor
    printer: Printer
  } & EventDeps,
): void {
  registerAppHandlers(deps)
  registerDisplayHandlers(deps)
  registerCameraHandlers(deps)
  registerEventHandlers(deps)
  registerPrinterHandlers(deps)
  registerGalleryHandlers(deps)
  registerWebcamHandlers(deps)
}
