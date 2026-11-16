import type { z } from 'zod'
import { IPC_CHANNELS } from './channels'
import {
  getPhotoInputSchema,
  sessionPhotoBytesSchema,
  appGetVersionInputSchema,
  appVersionSchema,
  cameraStatusSchema,
  displayStateSchema,
  eventStartInputSchema,
  eventStartResultSchema,
  galleryChangedSchema,
  galleryGetInputSchema,
  galleryImageSchema,
  galleryListSchema,
  galleryReprintInputSchema,
  galleryReprintResultSchema,
  layoutSaveInputSchema,
  layoutSaveResultSchema,
  layoutsSchema,
  noInputSchema,
  printerStatusSchema,
  sessionPhotoSchema,
  sessionPreviewSchema,
  sessionStateSchema,
  setCopiesInputSchema,
  setFramingInputSchema,
  setTimerInputSchema,
  shutterSchema,
  templateImportInputSchema,
  templateImportResultSchema,
  templatesSchema,
  updateStatusSchema,
  zoomStateSchema,
  zoomStepInputSchema,
  webcamReportSchema,
  webcamSetInputSchema,
  webcamStateSchema,
} from './schemas'

/**
 * One entry per `invoke` channel: the Zod schema of what the renderer sends and of what main returns.
 * Main validates the input before the handler runs and the output before it leaves the process.
 * The preload validates both again, so a renderer never sees an unchecked payload.
 */
export const INVOKE_CONTRACT = {
  [IPC_CHANNELS.appGetVersion]: { input: appGetVersionInputSchema, output: appVersionSchema },
  [IPC_CHANNELS.displayGetState]: { input: noInputSchema, output: displayStateSchema },
  [IPC_CHANNELS.displayHideTv]: { input: noInputSchema, output: displayStateSchema },
  [IPC_CHANNELS.displayShowTv]: { input: noInputSchema, output: displayStateSchema },
  [IPC_CHANNELS.cameraGetStatus]: { input: noInputSchema, output: cameraStatusSchema },
  [IPC_CHANNELS.templateGetAll]: { input: noInputSchema, output: templatesSchema },
  [IPC_CHANNELS.templateImport]: { input: templateImportInputSchema, output: templateImportResultSchema },
  [IPC_CHANNELS.eventStart]: { input: eventStartInputSchema, output: eventStartResultSchema },
  [IPC_CHANNELS.eventEnd]: { input: noInputSchema, output: sessionStateSchema },
  [IPC_CHANNELS.sessionGetState]: { input: noInputSchema, output: sessionStateSchema },
  [IPC_CHANNELS.sessionGetPreview]: { input: noInputSchema, output: sessionPreviewSchema },
  [IPC_CHANNELS.sessionGetPhoto]: { input: getPhotoInputSchema, output: sessionPhotoBytesSchema },
  [IPC_CHANNELS.sessionSetTimer]: { input: setTimerInputSchema, output: sessionStateSchema },
  [IPC_CHANNELS.sessionSetCopies]: { input: setCopiesInputSchema, output: sessionStateSchema },
  [IPC_CHANNELS.sessionSetFraming]: { input: setFramingInputSchema, output: sessionStateSchema },
  [IPC_CHANNELS.sessionCancel]: { input: noInputSchema, output: sessionStateSchema },
  [IPC_CHANNELS.sessionPrint]: { input: noInputSchema, output: sessionStateSchema },
  [IPC_CHANNELS.sessionReprint]: { input: noInputSchema, output: sessionStateSchema },
  [IPC_CHANNELS.sessionNewRound]: { input: noInputSchema, output: sessionStateSchema },
  [IPC_CHANNELS.layoutGet]: { input: noInputSchema, output: layoutsSchema },
  [IPC_CHANNELS.layoutSave]: { input: layoutSaveInputSchema, output: layoutSaveResultSchema },
  [IPC_CHANNELS.printerStatus]: { input: noInputSchema, output: printerStatusSchema },
  [IPC_CHANNELS.galleryList]: { input: noInputSchema, output: galleryListSchema },
  [IPC_CHANNELS.galleryGet]: { input: galleryGetInputSchema, output: galleryImageSchema },
  [IPC_CHANNELS.webcamGet]: { input: noInputSchema, output: webcamStateSchema },
  [IPC_CHANNELS.webcamSet]: { input: webcamSetInputSchema, output: webcamStateSchema },
  [IPC_CHANNELS.galleryReprint]: { input: galleryReprintInputSchema, output: galleryReprintResultSchema },
  [IPC_CHANNELS.updateGetStatus]: { input: noInputSchema, output: updateStatusSchema },
  [IPC_CHANNELS.zoomGet]: { input: noInputSchema, output: zoomStateSchema },
  [IPC_CHANNELS.zoomStep]: { input: zoomStepInputSchema, output: zoomStateSchema },
} as const satisfies Record<string, { input: z.ZodType; output: z.ZodType }>

/** Renderer → main, fire and forget. The preload validates before sending, main again on arrival. */
export const SEND_CONTRACT = {
  [IPC_CHANNELS.cameraReport]: cameraStatusSchema,
  [IPC_CHANNELS.cameraRequestPreviewPort]: noInputSchema,
  [IPC_CHANNELS.sessionRequestShutter]: noInputSchema,
  [IPC_CHANNELS.sessionPhoto]: sessionPhotoSchema,
  [IPC_CHANNELS.webcamReport]: webcamReportSchema,
} as const satisfies Record<string, z.ZodType>

/** Main → renderer pushes. Main validates before sending, the preload again before the listener. */
export const EVENT_CONTRACT = {
  [IPC_CHANNELS.displayState]: displayStateSchema,
  [IPC_CHANNELS.cameraStatus]: cameraStatusSchema,
  [IPC_CHANNELS.sessionState]: sessionStateSchema,
  [IPC_CHANNELS.sessionShutter]: shutterSchema,
  [IPC_CHANNELS.printerStatusChanged]: printerStatusSchema,
  [IPC_CHANNELS.galleryChanged]: galleryChangedSchema,
  [IPC_CHANNELS.webcamState]: webcamStateSchema,
  [IPC_CHANNELS.updateStatus]: updateStatusSchema,
  [IPC_CHANNELS.zoomState]: zoomStateSchema,
} as const satisfies Record<string, z.ZodType>

export type InvokeChannel = keyof typeof INVOKE_CONTRACT
export type InvokeInput<C extends InvokeChannel> = z.infer<(typeof INVOKE_CONTRACT)[C]['input']>
export type InvokeOutput<C extends InvokeChannel> = z.infer<(typeof INVOKE_CONTRACT)[C]['output']>

export type SendChannel = keyof typeof SEND_CONTRACT
export type SendPayload<C extends SendChannel> = z.infer<(typeof SEND_CONTRACT)[C]>

export type EventChannel = keyof typeof EVENT_CONTRACT
export type EventPayload<C extends EventChannel> = z.infer<(typeof EVENT_CONTRACT)[C]>
