import { IPC_CHANNELS, type UpdateStatus } from '@shared/ipc'
import { broadcast, handleInvoke } from './handle'

/** `update:get-status` (DESIGN §11): the background auto-update as main sees it now. */
export function registerUpdateHandlers({ updateStatus }: { updateStatus: () => UpdateStatus }): void {
  handleInvoke(IPC_CHANNELS.updateGetStatus, () => updateStatus())
}

/** Pushes every update status change to the windows; only the laptop shows it. */
export function broadcastUpdateStatus(status: UpdateStatus): void {
  broadcast(IPC_CHANNELS.updateStatus, status)
}
