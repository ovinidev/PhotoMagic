import { IPC_CHANNELS } from '@shared/ipc'
import type { GuestWindowController } from '../windows'
import { broadcast, handleInvoke } from './handle'

/** `display:*`: TV monitor choice and the TV window state (DESIGN §3, §4). `event:*` opens and closes it. */
export function registerDisplayHandlers({ tv }: { tv: GuestWindowController }): void {
  handleInvoke(IPC_CHANNELS.displayGetState, () => tv.state())
  tv.onChange((state) => broadcast(IPC_CHANNELS.displayState, state))
}
