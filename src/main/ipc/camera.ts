import type { WebContents } from 'electron'
import { IPC_CHANNELS, type CameraStatus } from '@shared/ipc'
import type { GuestWindowController } from '../windows'
import { broadcast, handleInvoke, handleSend } from './handle'

/**
 * `camera:*`: the TV owns the `MediaStream` and reports its state; main keeps the last report and
 * relays it so the laptop can show it (DESIGN §4, §5). Reports from any other window are ignored.
 */
export function registerCameraHandlers({
  tv,
  isGuestWindow,
}: {
  tv: GuestWindowController
  isGuestWindow: (contents: WebContents) => boolean
}): void {
  let status: CameraStatus = { kind: 'idle' }
  const update = (next: CameraStatus) => {
    status = next
    broadcast(IPC_CHANNELS.cameraStatus, status)
  }

  handleInvoke(IPC_CHANNELS.cameraGetStatus, () => status)
  handleSend(IPC_CHANNELS.cameraReport, (report, event) => {
    if (!isGuestWindow(event.sender)) return
    update(report)
  })
  // No TV window, no camera: whatever the TV last said is stale.
  tv.onChange((state) => {
    if (state.tv.kind === 'closed' && status.kind !== 'idle') update({ kind: 'idle' })
  })
}
