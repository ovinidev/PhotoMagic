import type { WebContents } from 'electron'
import { IPC_CHANNELS } from '@shared/ipc'
import type { GuestWindowController } from '../windows'
import { broadcast, handleInvoke } from './handle'

/**
 * `display:*`: TV monitor choice and the TV window state (DESIGN §3, §4). `event:*` opens and closes
 * it. Only the TV may hide itself (two-finger hold) and only the laptop may show it again.
 */
export function registerDisplayHandlers({
  tv,
  isGuestWindow,
}: {
  tv: GuestWindowController
  isGuestWindow: (contents: WebContents) => boolean
}): void {
  handleInvoke(IPC_CHANNELS.displayGetState, () => tv.state())
  handleInvoke(IPC_CHANNELS.displayHideTv, (_input, event) => (isGuestWindow(event.sender) ? tv.dismiss() : tv.state()))
  handleInvoke(IPC_CHANNELS.displayShowTv, (_input, event) => (isGuestWindow(event.sender) ? tv.state() : tv.reopen()))
  tv.onChange((state) => broadcast(IPC_CHANNELS.displayState, state))
}
