/**
 * Stable IPC channel names. The renderer never builds these strings by hand:
 * it only calls the typed `window.fotomagica` object exposed by the preload.
 */
export const IPC_CHANNELS = {
  // invoke: renderer asks, main answers
  appGetVersion: 'app:get-version',
  displayGetState: 'display:get-state',
  cameraGetStatus: 'camera:get-status',
  templateGetAll: 'template:get-all',
  templateImport: 'template:import',
  eventStart: 'event:start',
  eventEnd: 'event:end',
  sessionGetState: 'session:get-state',
  sessionGetPreview: 'session:get-preview',
  sessionSetTimer: 'session:set-timer',
  sessionSetCopies: 'session:set-copies',
  sessionCancel: 'session:cancel',
  sessionPrint: 'session:print',
  sessionReprint: 'session:reprint',
  sessionNewRound: 'session:new-round',
  // send: renderer → main, no answer
  cameraReport: 'camera:report',
  cameraRequestPreviewPort: 'camera:request-preview-port',
  sessionRequestShutter: 'session:request-shutter',
  sessionPhoto: 'session:photo',
  // event: main → renderer
  displayState: 'display:state',
  cameraStatus: 'camera:status',
  sessionState: 'session:state',
  sessionShutter: 'session:shutter',
} as const

/**
 * Main → renderer hand-off of a `MessagePort`. Not in `IPC_CHANNELS`: the message has no payload to
 * validate, only the transferred port.
 */
export const PORT_CHANNELS = {
  cameraPreviewPort: 'camera:preview-port',
} as const

/**
 * The live laptop preview travels over a `MessageChannel` between the two windows (DESIGN §5). The
 * preload receives the port from main and re-posts it to the page with `window.postMessage`, since
 * `contextBridge` cannot carry a port. The page recognizes it by this message data.
 */
export const PREVIEW_PORT_MESSAGE = 'fotomagica:camera-preview-port'

export type IpcChannel = (typeof IPC_CHANNELS)[keyof typeof IPC_CHANNELS]
