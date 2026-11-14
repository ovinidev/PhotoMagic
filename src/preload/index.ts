import { contextBridge, ipcRenderer } from 'electron'
import {
  INVOKE_CONTRACT,
  IPC_CHANNELS,
  type FotomagicaApi,
  type InvokeChannel,
  type InvokeInput,
  type InvokeOutput,
} from '@shared/ipc'

/** Validates the input before it leaves the renderer and the output before the renderer sees it. */
async function invoke<C extends InvokeChannel>(channel: C, input: InvokeInput<C>): Promise<InvokeOutput<C>> {
  const { input: inputSchema, output: outputSchema } = INVOKE_CONTRACT[channel]
  const result: unknown = await ipcRenderer.invoke(channel, inputSchema.parse(input))
  return outputSchema.parse(result) as InvokeOutput<C>
}

const api: FotomagicaApi = {
  app: {
    getVersion: () => invoke(IPC_CHANNELS.appGetVersion, undefined),
  },
}

contextBridge.exposeInMainWorld('fotomagica', api)
