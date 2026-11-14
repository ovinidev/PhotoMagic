import type { z } from 'zod'
import { IPC_CHANNELS } from './channels'
import { appGetVersionInputSchema, appVersionSchema } from './schemas'

/**
 * One entry per `invoke` channel: the Zod schema of what the renderer sends and of what main returns.
 * Main validates the input before the handler runs and the output before it leaves the process.
 * The preload validates both again, so a renderer never sees an unchecked payload.
 */
export const INVOKE_CONTRACT = {
  [IPC_CHANNELS.appGetVersion]: {
    input: appGetVersionInputSchema,
    output: appVersionSchema,
  },
} as const satisfies Record<string, { input: z.ZodType; output: z.ZodType }>

export type InvokeChannel = keyof typeof INVOKE_CONTRACT
export type InvokeInput<C extends InvokeChannel> = z.infer<(typeof INVOKE_CONTRACT)[C]['input']>
export type InvokeOutput<C extends InvokeChannel> = z.infer<(typeof INVOKE_CONTRACT)[C]['output']>
