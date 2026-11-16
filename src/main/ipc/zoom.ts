import type { WebContents } from 'electron'
import { IPC_CHANNELS, type ZoomState } from '@shared/ipc'
import type { OperatorZoom } from '../windows'
import { broadcast, handleInvoke } from './handle'

/** `zoom:get` and `zoom:step` (DESIGN §3): the laptop window zoom. The TV cannot change it. */
export function registerZoomHandlers({ zoom, isGuestWindow }: { zoom: OperatorZoom; isGuestWindow: (contents: WebContents) => boolean }): void {
  handleInvoke(IPC_CHANNELS.zoomGet, () => zoom.state())
  handleInvoke(IPC_CHANNELS.zoomStep, ({ step }, event) => (isGuestWindow(event.sender) ? zoom.state() : zoom.step(step)))
}

/** Pushes the zoom to the windows; only the laptop shows it. */
export function broadcastZoomState(state: ZoomState): void {
  broadcast(IPC_CHANNELS.zoomState, state)
}
