/**
 * Stable IPC channel names. The renderer never builds these strings by hand:
 * it only calls the typed `window.fotomagica` object exposed by the preload.
 */
export const IPC_CHANNELS = {
  // invoke: renderer asks, main answers
  appGetVersion: 'app:get-version',
  displayGetState: 'display:get-state',
  tvOpen: 'tv:open',
  tvClose: 'tv:close',
  cameraGetStatus: 'camera:get-status',
  // send: renderer → main, no answer
  cameraReport: 'camera:report',
  // event: main → renderer
  displayState: 'display:state',
  cameraStatus: 'camera:status',
} as const

export type IpcChannel = (typeof IPC_CHANNELS)[keyof typeof IPC_CHANNELS]
