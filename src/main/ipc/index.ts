import type { WebContents } from 'electron'
import type { UpdateStatus } from '@shared/ipc'
import type { RuntimeFlags } from '@shared/runtime'
import type { Printer, PrinterMonitor } from '../print'
import type { ShareService } from '../share'
import type { GuestWindowController, OperatorZoom } from '../windows'
import { registerAppHandlers } from './app'
import { registerCameraHandlers } from './camera'
import { registerDisplayHandlers } from './display'
import { registerEventHandlers, type EventDeps } from './event'
import { registerGalleryHandlers } from './gallery'
import { registerPrinterHandlers } from './printer'
import { registerShareHandlers } from './share'
import { registerUpdateHandlers } from './update'
import { registerWebcamHandlers } from './webcam'
import { registerZoomHandlers } from './zoom'

export { broadcastSession } from './event'
export { broadcastPrinterStatus } from './printer'
export { broadcastGalleryChanged } from './gallery'
export { broadcastUpdateStatus } from './update'
export { broadcastZoomState } from './zoom'
export { broadcastShareState } from './share'

/** One module per area; each registers its own channels. */
export function registerIpcHandlers(
  deps: {
    flags: RuntimeFlags
    tv: GuestWindowController
    isGuestWindow: (contents: WebContents) => boolean
    printerMonitor: PrinterMonitor
    printer: Printer
    updateStatus: () => UpdateStatus
    zoom: OperatorZoom
    share: ShareService
  } & EventDeps,
): void {
  registerAppHandlers(deps)
  registerDisplayHandlers(deps)
  registerCameraHandlers(deps)
  registerEventHandlers(deps)
  registerPrinterHandlers(deps)
  registerGalleryHandlers(deps)
  registerWebcamHandlers(deps)
  registerUpdateHandlers(deps)
  registerZoomHandlers(deps)
  registerShareHandlers(deps)
}
