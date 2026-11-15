import { contextBridge, ipcRenderer, type IpcRendererEvent } from 'electron'
import {
  EVENT_CONTRACT,
  INVOKE_CONTRACT,
  IPC_CHANNELS,
  SEND_CONTRACT,
  type EventChannel,
  type EventPayload,
  type FotomagicaApi,
  type InvokeChannel,
  type InvokeInput,
  type InvokeOutput,
  type SendChannel,
  type SendPayload,
  type Unsubscribe,
} from '@shared/ipc'

/** Validates the input before it leaves the renderer and the output before the renderer sees it. */
async function invoke<C extends InvokeChannel>(channel: C, input: InvokeInput<C>): Promise<InvokeOutput<C>> {
  const { input: inputSchema, output: outputSchema } = INVOKE_CONTRACT[channel]
  const result: unknown = await ipcRenderer.invoke(channel, inputSchema.parse(input))
  return outputSchema.parse(result) as InvokeOutput<C>
}

/** Validates before sending; an invalid payload throws in the renderer instead of reaching main. */
function send<C extends SendChannel>(channel: C, payload: SendPayload<C>): void {
  ipcRenderer.send(channel, SEND_CONTRACT[channel].parse(payload))
}

/** Subscribes to a main → renderer event. A payload that fails its schema never reaches the listener. */
function subscribe<C extends EventChannel>(channel: C, listener: (payload: EventPayload<C>) => void): Unsubscribe {
  const schema = EVENT_CONTRACT[channel]
  const handler = (_event: IpcRendererEvent, payload: unknown) => {
    const parsed = schema.safeParse(payload)
    if (parsed.success) listener(parsed.data as EventPayload<C>)
    else console.error(`[ipc] dropped invalid ${channel} event`, parsed.error.issues)
  }
  ipcRenderer.on(channel, handler)
  return () => {
    ipcRenderer.removeListener(channel, handler)
  }
}

const api: FotomagicaApi = {
  app: {
    getVersion: () => invoke(IPC_CHANNELS.appGetVersion, undefined),
  },
  display: {
    getState: () => invoke(IPC_CHANNELS.displayGetState, undefined),
    onState: (listener) => subscribe(IPC_CHANNELS.displayState, listener),
  },
  tv: {
    open: (input) => invoke(IPC_CHANNELS.tvOpen, input),
    close: () => invoke(IPC_CHANNELS.tvClose, undefined),
  },
  camera: {
    getStatus: () => invoke(IPC_CHANNELS.cameraGetStatus, undefined),
    onStatus: (listener) => subscribe(IPC_CHANNELS.cameraStatus, listener),
    report: (status) => send(IPC_CHANNELS.cameraReport, status),
  },
}

contextBridge.exposeInMainWorld('fotomagica', api)
