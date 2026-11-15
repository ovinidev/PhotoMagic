import { IPC_CHANNELS } from '@shared/ipc'
import type { GuestWindowController } from '../windows'
import { broadcast, handleInvoke } from './handle'

/** `display:*` and `tv:*`: TV monitor choice and the TV window (DESIGN §3, §4). */
export function registerDisplayHandlers({ tv }: { tv: GuestWindowController }): void {
  handleInvoke(IPC_CHANNELS.displayGetState, () => tv.state())
  handleInvoke(IPC_CHANNELS.tvOpen, (input) => tv.open(input))
  handleInvoke(IPC_CHANNELS.tvClose, () => tv.close())
  tv.onChange((state) => broadcast(IPC_CHANNELS.displayState, state))
}
