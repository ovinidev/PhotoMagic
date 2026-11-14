import type { RuntimeFlags } from '@shared/runtime'
import { registerAppHandlers } from './app'

/** One module per area; each registers its own channels. */
export function registerIpcHandlers(deps: { flags: RuntimeFlags }): void {
  registerAppHandlers(deps)
}
