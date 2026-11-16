import { BrowserWindow, ipcMain, type IpcMainEvent, type IpcMainInvokeEvent, type WebContents } from 'electron'
import {
  EVENT_CONTRACT,
  INVOKE_CONTRACT,
  SEND_CONTRACT,
  type EventChannel,
  type EventPayload,
  type InvokeChannel,
  type InvokeInput,
  type InvokeOutput,
  type SendChannel,
  type SendPayload,
} from '@shared/ipc'

/**
 * Registers an `invoke` handler that validates the payload with the channel's Zod schema before
 * the handler runs, and validates the result before it leaves main.
 */
export function handleInvoke<C extends InvokeChannel>(
  channel: C,
  handler: (input: InvokeInput<C>, event: IpcMainInvokeEvent) => InvokeOutput<C> | Promise<InvokeOutput<C>>,
): void {
  const { input: inputSchema, output: outputSchema } = INVOKE_CONTRACT[channel]
  ipcMain.handle(channel, async (event, payload: unknown) => {
    const input = inputSchema.parse(payload) as InvokeInput<C>
    return outputSchema.parse(await handler(input, event))
  })
}

/** Registers a renderer → main `send` listener. An invalid payload is dropped before the handler. */
export function handleSend<C extends SendChannel>(
  channel: C,
  handler: (payload: SendPayload<C>, event: IpcMainEvent) => void,
): void {
  const schema = SEND_CONTRACT[channel]
  ipcMain.on(channel, (event, payload: unknown) => {
    const parsed = schema.safeParse(payload)
    if (!parsed.success) {
      console.warn(`[ipc] dropped invalid ${channel} payload`, parsed.error.issues)
      return
    }
    handler(parsed.data as SendPayload<C>, event)
  })
}

/** Pushes a validated main → renderer event to every open window. */
export function broadcast<C extends EventChannel>(channel: C, payload: EventPayload<C>): void {
  const data = EVENT_CONTRACT[channel].parse(payload)
  for (const window of BrowserWindow.getAllWindows()) {
    if (!window.isDestroyed()) window.webContents.send(channel, data)
  }
}

/** Pushes a validated main → renderer event to one window only. */
export function sendTo<C extends EventChannel>(contents: WebContents, channel: C, payload: EventPayload<C>): void {
  const data = EVENT_CONTRACT[channel].parse(payload)
  if (!contents.isDestroyed()) contents.send(channel, data)
}
