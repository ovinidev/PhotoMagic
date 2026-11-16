import { contextBridge, ipcRenderer, type IpcRendererEvent } from 'electron'
import {
  EVENT_CONTRACT,
  INVOKE_CONTRACT,
  IPC_CHANNELS,
  PORT_CHANNELS,
  PREVIEW_PORT_MESSAGE,
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
    hideTv: () => invoke(IPC_CHANNELS.displayHideTv, undefined),
    showTv: () => invoke(IPC_CHANNELS.displayShowTv, undefined),
    onState: (listener) => subscribe(IPC_CHANNELS.displayState, listener),
  },
  camera: {
    getStatus: () => invoke(IPC_CHANNELS.cameraGetStatus, undefined),
    onStatus: (listener) => subscribe(IPC_CHANNELS.cameraStatus, listener),
    report: (status) => send(IPC_CHANNELS.cameraReport, status),
    requestPreviewPort: () => send(IPC_CHANNELS.cameraRequestPreviewPort, undefined),
  },
  template: {
    getAll: () => invoke(IPC_CHANNELS.templateGetAll, undefined),
    import: (input) => invoke(IPC_CHANNELS.templateImport, input),
  },
  layout: {
    get: () => invoke(IPC_CHANNELS.layoutGet, undefined),
    save: (input) => invoke(IPC_CHANNELS.layoutSave, input),
  },
  event: {
    start: (input) => invoke(IPC_CHANNELS.eventStart, input),
    end: () => invoke(IPC_CHANNELS.eventEnd, undefined),
  },
  session: {
    getState: () => invoke(IPC_CHANNELS.sessionGetState, undefined),
    onState: (listener) => subscribe(IPC_CHANNELS.sessionState, listener),
    getPreview: () => invoke(IPC_CHANNELS.sessionGetPreview, undefined),
    getPhoto: (index) => invoke(IPC_CHANNELS.sessionGetPhoto, { index }),
    setTimer: (timer) => invoke(IPC_CHANNELS.sessionSetTimer, { timer }),
    setCopies: (copies) => invoke(IPC_CHANNELS.sessionSetCopies, { copies }),
    setFraming: (input) => invoke(IPC_CHANNELS.sessionSetFraming, input),
    cancel: () => invoke(IPC_CHANNELS.sessionCancel, undefined),
    print: () => invoke(IPC_CHANNELS.sessionPrint, undefined),
    reprint: () => invoke(IPC_CHANNELS.sessionReprint, undefined),
    newRound: () => invoke(IPC_CHANNELS.sessionNewRound, undefined),
    requestShutter: () => send(IPC_CHANNELS.sessionRequestShutter, undefined),
    onShutter: (listener) => subscribe(IPC_CHANNELS.sessionShutter, () => listener()),
    sendPhoto: (photo) => send(IPC_CHANNELS.sessionPhoto, photo),
  },
  webcam: {
    getState: () => invoke(IPC_CHANNELS.webcamGet, undefined),
    set: (values) => invoke(IPC_CHANNELS.webcamSet, { values }),
    report: (report) => send(IPC_CHANNELS.webcamReport, report),
    onState: (listener) => subscribe(IPC_CHANNELS.webcamState, listener),
  },
  gallery: {
    list: () => invoke(IPC_CHANNELS.galleryList, undefined),
    get: (input) => invoke(IPC_CHANNELS.galleryGet, input),
    reprint: (fileName) => invoke(IPC_CHANNELS.galleryReprint, { fileName }),
    onChanged: (listener) => subscribe(IPC_CHANNELS.galleryChanged, () => listener()),
  },
  printer: {
    getStatus: () => invoke(IPC_CHANNELS.printerStatus, undefined),
    onStatus: (listener) => subscribe(IPC_CHANNELS.printerStatusChanged, listener),
  },
  update: {
    getStatus: () => invoke(IPC_CHANNELS.updateGetStatus, undefined),
    onStatus: (listener) => subscribe(IPC_CHANNELS.updateStatus, listener),
  },
  zoom: {
    get: () => invoke(IPC_CHANNELS.zoomGet, undefined),
    step: (step) => invoke(IPC_CHANNELS.zoomStep, { step }),
    onState: (listener) => subscribe(IPC_CHANNELS.zoomState, listener),
  },
}

contextBridge.exposeInMainWorld('fotomagica', api)

/** The page's `window`, typed for the one call below (the preload's tsconfig has no DOM lib). */
const page = globalThis as unknown as { postMessage: (message: string, targetOrigin: string, transfer: unknown[]) => void }

// The live-preview port cannot cross `contextBridge`; hand it to the page with `postMessage` (DESIGN §5).
// The target is this same window, so '*' does not leak it: `file://` pages have the opaque origin 'null'.
ipcRenderer.on(PORT_CHANNELS.cameraPreviewPort, (event) => {
  const [port] = event.ports
  if (port) page.postMessage(PREVIEW_PORT_MESSAGE, '*', [port])
})
