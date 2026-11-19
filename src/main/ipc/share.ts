import type { WebContents } from 'electron'
import { IPC_CHANNELS, type ShareState } from '@shared/ipc'
import { saveShare } from '../persist'
import type { ShareService } from '../share'
import { broadcast, handleInvoke } from './handle'

/** `share:*` (DESIGN §15). Only the laptop saves the settings; the TV reads the state. */
export function registerShareHandlers({ share, userData, isGuestWindow }: { share: ShareService; userData: string; isGuestWindow: (contents: WebContents) => boolean }): void {
  handleInvoke(IPC_CHANNELS.shareGetSettings, () => share.settings())
  handleInvoke(IPC_CHANNELS.shareGetState, () => share.state())
  handleInvoke(IPC_CHANNELS.shareSaveSettings, async (settings, event) => {
    if (isGuestWindow(event.sender)) return share.state()
    await saveShare(userData, settings)
    return share.apply(settings)
  })
}

export function broadcastShareState(state: ShareState): void {
  broadcast(IPC_CHANNELS.shareState, state)
}
