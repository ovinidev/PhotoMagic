import { ipcMain } from 'electron'
import { INVOKE_CONTRACT, type InvokeChannel, type InvokeInput, type InvokeOutput } from '@shared/ipc'

/**
 * Registers an `invoke` handler that validates the payload with the channel's Zod schema before
 * the handler runs, and validates the result before it leaves main.
 */
export function handleInvoke<C extends InvokeChannel>(
  channel: C,
  handler: (input: InvokeInput<C>) => InvokeOutput<C> | Promise<InvokeOutput<C>>,
): void {
  const { input: inputSchema, output: outputSchema } = INVOKE_CONTRACT[channel]
  ipcMain.handle(channel, async (_event, payload: unknown) => {
    const input = inputSchema.parse(payload) as InvokeInput<C>
    return outputSchema.parse(await handler(input))
  })
}
