/**
 * Stable IPC channel names. The renderer never builds these strings by hand:
 * it only calls the typed `window.fotomagica` object exposed by the preload.
 */
export const IPC_CHANNELS = {
  // invoke: renderer asks, main answers
  appGetVersion: 'app:get-version',
  displayGetState: 'display:get-state',
  displayHideTv: 'display:hide-tv',
  displayShowTv: 'display:show-tv',
  cameraGetStatus: 'camera:get-status',
  templateGetAll: 'template:get-all',
  templateImport: 'template:import',
  eventStart: 'event:start',
  eventEnd: 'event:end',
  sessionGetState: 'session:get-state',
  sessionGetPreview: 'session:get-preview',
  sessionGetPhoto: 'session:get-photo',
  sessionSetTimer: 'session:set-timer',
  sessionSetCopies: 'session:set-copies',
  sessionSetFraming: 'session:set-framing',
  sessionCancel: 'session:cancel',
  sessionPrint: 'session:print',
  sessionReprint: 'session:reprint',
  sessionNewRound: 'session:new-round',
  layoutGet: 'layout:get',
  layoutSave: 'layout:save',
  printerStatus: 'printer:status',
  galleryList: 'gallery:list',
  galleryGet: 'gallery:get',
  galleryReprint: 'gallery:reprint',
  webcamGet: 'webcam:get',
  webcamSet: 'webcam:set',
  updateGetStatus: 'update:get-status',
  zoomGet: 'zoom:get',
  zoomStep: 'zoom:step',
  shareGetSettings: 'share:get-settings',
  shareSaveSettings: 'share:save-settings',
  shareGetState: 'share:get-state',
  // send: renderer → main, no answer
  cameraReport: 'camera:report',
  sessionRequestShutter: 'session:request-shutter',
  sessionPhoto: 'session:photo',
  webcamReport: 'webcam:report',
  // event: main → renderer
  displayState: 'display:state',
  cameraStatus: 'camera:status',
  sessionState: 'session:state',
  sessionShutter: 'session:shutter',
  printerStatusChanged: 'printer:status-changed',
  galleryChanged: 'gallery:changed',
  webcamState: 'webcam:state',
  updateStatus: 'update:status',
  zoomState: 'zoom:state',
  shareState: 'share:state',
} as const

export type IpcChannel = (typeof IPC_CHANNELS)[keyof typeof IPC_CHANNELS]
