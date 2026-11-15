import type { z } from 'zod'
import { IPC_CHANNELS } from './channels'
import {
  appGetVersionInputSchema,
  appVersionSchema,
  cameraStatusSchema,
  displayStateSchema,
  noInputSchema,
  tvOpenInputSchema,
  tvOpenResultSchema,
} from './schemas'

/**
 * One entry per `invoke` channel: the Zod schema of what the renderer sends and of what main returns.
 * Main validates the input before the handler runs and the output before it leaves the process.
 * The preload validates both again, so a renderer never sees an unchecked payload.
 */
export const INVOKE_CONTRACT = {
  [IPC_CHANNELS.appGetVersion]: { input: appGetVersionInputSchema, output: appVersionSchema },
  [IPC_CHANNELS.displayGetState]: { input: noInputSchema, output: displayStateSchema },
  [IPC_CHANNELS.tvOpen]: { input: tvOpenInputSchema, output: tvOpenResultSchema },
  [IPC_CHANNELS.tvClose]: { input: noInputSchema, output: displayStateSchema },
  [IPC_CHANNELS.cameraGetStatus]: { input: noInputSchema, output: cameraStatusSchema },
} as const satisfies Record<string, { input: z.ZodType; output: z.ZodType }>

/** Renderer → main, fire and forget. The preload validates before sending, main again on arrival. */
export const SEND_CONTRACT = {
  [IPC_CHANNELS.cameraReport]: cameraStatusSchema,
} as const satisfies Record<string, z.ZodType>

/** Main → renderer pushes. Main validates before sending, the preload again before the listener. */
export const EVENT_CONTRACT = {
  [IPC_CHANNELS.displayState]: displayStateSchema,
  [IPC_CHANNELS.cameraStatus]: cameraStatusSchema,
} as const satisfies Record<string, z.ZodType>

export type InvokeChannel = keyof typeof INVOKE_CONTRACT
export type InvokeInput<C extends InvokeChannel> = z.infer<(typeof INVOKE_CONTRACT)[C]['input']>
export type InvokeOutput<C extends InvokeChannel> = z.infer<(typeof INVOKE_CONTRACT)[C]['output']>

export type SendChannel = keyof typeof SEND_CONTRACT
export type SendPayload<C extends SendChannel> = z.infer<(typeof SEND_CONTRACT)[C]>

export type EventChannel = keyof typeof EVENT_CONTRACT
export type EventPayload<C extends EventChannel> = z.infer<(typeof EVENT_CONTRACT)[C]>
