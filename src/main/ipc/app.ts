import { app } from 'electron'
import { IPC_CHANNELS } from '@shared/ipc'
import type { RuntimeFlags } from '@shared/runtime'
import { handleInvoke } from './handle'

export function registerAppHandlers({ flags }: { flags: RuntimeFlags }): void {
  handleInvoke(IPC_CHANNELS.appGetVersion, () => ({
    version: app.getVersion(),
    e2e: flags.e2e,
  }))
}
