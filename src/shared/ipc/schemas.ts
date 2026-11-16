import { z } from 'zod'
import { COPIES } from '../constants'
import type { DisplayInfo, GuestChoice } from '../displays'
import { WEBCAM_CONTROL_IDS, WHITE_BALANCE_MODES, type WebcamCapabilities, type WebcamValues } from '../webcam'
import { EVENT_NAME_MAX_LENGTH, isMontageFileName } from '../files'
import { FRAMING_ROTATION_RANGE, PRINT_MODES, ZOOM_RANGE, type Framing } from '../layout'

/** `app:get-version` takes no input. */
export const appGetVersionInputSchema = z.undefined()

/** `app:get-version` output: the `package.json` version and whether the app runs under E2E. */
export const appVersionSchema = z.strictObject({
  version: z.string().regex(/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/, 'Expected a semver version'),
  e2e: z.boolean(),
})

export type AppVersion = z.infer<typeof appVersionSchema>

/**
 * `update:status` (DESIGN §11): what electron-updater is doing in the background. `idle` covers
 * "not checked", "up to date" and every failure (offline is the normal case at a party), so the
 * laptop only ever shows a download in progress or one waiting for the next quit.
 */
export const updateStatusSchema = z.discriminatedUnion('kind', [
  z.strictObject({ kind: z.literal('idle') }),
  z.strictObject({ kind: z.literal('downloading'), version: z.string().min(1), percent: z.number().min(0).max(100) }),
  z.strictObject({ kind: z.literal('ready'), version: z.string().min(1) }),
])

export type UpdateStatus = z.infer<typeof updateStatusSchema>

/** Channels that take no input. */
export const noInputSchema = z.undefined()

// ── Displays and the TV window (DESIGN §3) ───────────────────────────────────

export const displayInfoSchema = z.strictObject({
  id: z.number().int(),
  primary: z.boolean(),
  x: z.number().int(),
  y: z.number().int(),
  width: z.number().int().positive(),
  height: z.number().int().positive(),
}) satisfies z.ZodType<DisplayInfo>

export const guestChoiceSchema = z.discriminatedUnion('kind', [
  z.strictObject({ kind: z.literal('portrait'), display: displayInfoSchema }),
  z.strictObject({ kind: z.literal('landscape-external'), display: displayInfoSchema }),
  z.strictObject({ kind: z.literal('missing') }),
]) satisfies z.ZodType<GuestChoice>

/** Why the TV window cannot be on screen: no TV, or a landscape TV the operator has not confirmed. */
export const tvUnavailableReasonSchema = z.enum(['missing', 'landscape'])

/**
 * The TV window: not created, on screen on a monitor, or created but hidden because its monitor
 * went away (it comes back when an eligible TV is connected again).
 */
export const tvWindowStateSchema = z.discriminatedUnion('kind', [
  z.strictObject({ kind: z.literal('closed') }),
  z.strictObject({ kind: z.literal('open'), display: displayInfoSchema }),
  z.strictObject({ kind: z.literal('detached'), reason: tvUnavailableReasonSchema }),
])

/** `display:get-state` output and `display:state` payload. */
export const displayStateSchema = z.strictObject({
  guest: guestChoiceSchema,
  tv: tvWindowStateSchema,
})

export const tvOpenInputSchema = z.strictObject({
  /** The operator confirmed the warning that the TV is not in portrait (RF04). */
  allowLandscape: z.boolean(),
})

export const tvOpenResultSchema = z.discriminatedUnion('ok', [
  z.strictObject({ ok: z.literal(true), state: displayStateSchema }),
  z.strictObject({ ok: z.literal(false), reason: tvUnavailableReasonSchema, state: displayStateSchema }),
])

export type TvUnavailableReason = z.infer<typeof tvUnavailableReasonSchema>
export type TvWindowState = z.infer<typeof tvWindowStateSchema>
export type DisplayState = z.infer<typeof displayStateSchema>
export type TvOpenInput = z.infer<typeof tvOpenInputSchema>
export type TvOpenResult = z.infer<typeof tvOpenResultSchema>

// ── Camera (DESIGN §5) ───────────────────────────────────────────────────────

export const cameraErrorReasonSchema = z.enum(['permission-denied', 'not-found', 'in-use', 'disconnected', 'unknown'])

/** What the TV reports about its `MediaStream`; main relays it to the laptop. */
export const cameraStatusSchema = z.discriminatedUnion('kind', [
  /** The TV window is not open, so no camera is open. */
  z.strictObject({ kind: z.literal('idle') }),
  z.strictObject({ kind: z.literal('starting') }),
  z.strictObject({
    kind: z.literal('live'),
    label: z.string().max(256),
    /** 0 when the track does not report its size. */
    width: z.number().int().nonnegative(),
    height: z.number().int().nonnegative(),
  }),
  z.strictObject({ kind: z.literal('error'), reason: cameraErrorReasonSchema }),
])

export type CameraErrorReason = z.infer<typeof cameraErrorReasonSchema>
export type CameraStatus = z.infer<typeof cameraStatusSchema>

// ── Binary payloads ──────────────────────────────────────────────────────────

/**
 * Bytes that cross IPC (a capture, a preview, a template). Checked by tag rather than
 * `instanceof`: the preload's isolated world and the page have different `Uint8Array` globals.
 */
export function bytesSchema(maxBytes: number) {
  return z
    .custom<Uint8Array>((value) => Object.prototype.toString.call(value) === '[object Uint8Array]', 'Expected a Uint8Array')
    .refine((value) => value.byteLength > 0 && value.byteLength <= maxBytes, `Expected 1 to ${maxBytes} bytes`)
}

/** A 1920×1080 quality-95 JPEG is well under 1 MB; 40 MB leaves room for a larger camera mode without letting a renderer exhaust main. */
const MAX_CAPTURE_BYTES = 40 * 1024 * 1024
const MAX_TEMPLATE_BYTES = 50 * 1024 * 1024
const MAX_PREVIEW_BYTES = 10 * 1024 * 1024

// ── Layouts and templates (DESIGN §6, §9) ────────────────────────────────────

export const printModeSchema = z.enum(PRINT_MODES)
export const photoIndexSchema = z.union([z.literal(1), z.literal(2), z.literal(3)])

/** One slot of a layout. Minimum size 40×40 (DESIGN §7). */
export const slotSchema = z.strictObject({
  id: z.string().min(1).max(32),
  photo: photoIndexSchema.nullable(),
  left: z.number().finite(),
  top: z.number().finite(),
  width: z.number().finite().min(40),
  height: z.number().finite().min(40),
  angle: z.number().finite(),
  radius: z.number().finite().min(0).max(500).optional(),
})

export const slotListSchema = z.array(slotSchema).min(1).max(12)

/** `layout:get` output: both layouts (RF03). */
export const layoutsSchema = z.strictObject({
  'two-strips': slotListSchema,
  'one-strip': slotListSchema,
})

/** `layout:save` input: only the layout on screen; the other mode is not written (DESIGN §7). */
export const layoutSaveInputSchema = z.strictObject({
  mode: printModeSchema,
  slots: slotListSchema,
})

/** `layout:save` output. `event-open`: the editor does not write while an event runs (PRD §6.3). */
export const layoutSaveResultSchema = z.discriminatedUnion('ok', [
  z.strictObject({ ok: z.literal(true), layouts: layoutsSchema }),
  z.strictObject({ ok: z.literal(false), reason: z.enum(['event-open', 'failed']) }),
])

export type LayoutSaveInput = z.infer<typeof layoutSaveInputSchema>
export type LayoutSaveResult = z.infer<typeof layoutSaveResultSchema>

/** A template stored for one mode. `preview` is a small JPEG of it for the create-event screen. */
export const templateInfoSchema = z.strictObject({
  mode: printModeSchema,
  fileName: z.string().min(1).max(260),
  width: z.number().int().positive(),
  height: z.number().int().positive(),
  preview: bytesSchema(MAX_PREVIEW_BYTES),
})

/** `template:get-all` output: each mode's stored template, or `null`. */
export const templatesSchema = z.strictObject({
  'two-strips': templateInfoSchema.nullable(),
  'one-strip': templateInfoSchema.nullable(),
})

export const templateImportInputSchema = z.strictObject({
  mode: printModeSchema,
  fileName: z.string().min(1).max(260),
  bytes: bytesSchema(MAX_TEMPLATE_BYTES),
})

/** `template:import` output. Only an accepted file replaces that mode's template; the other mode is untouched. */
export const templateImportResultSchema = z.discriminatedUnion('ok', [
  z.strictObject({ ok: z.literal(true), template: templateInfoSchema }),
  z.strictObject({
    ok: z.literal(false),
    reason: z.enum(['format', 'size', 'unreadable', 'pdf']),
    width: z.number().int().nonnegative().optional(),
    height: z.number().int().nonnegative().optional(),
  }),
])

export type PrintModeValue = z.infer<typeof printModeSchema>
export type TemplateInfo = z.infer<typeof templateInfoSchema>
export type Templates = z.infer<typeof templatesSchema>
export type TemplateImportInput = z.infer<typeof templateImportInputSchema>
export type TemplateImportResult = z.infer<typeof templateImportResultSchema>

// ── Event and round (PRD §5, §6.3–6.5; DESIGN §4, §8–10) ─────────────────────

export const timerSchema = z.union([z.literal(0), z.literal(5), z.literal(10)])
export const copiesSchema = z.number().int().min(COPIES.min).max(COPIES.max)

/**
 * The printer as the Windows spooler reports it (DESIGN §10). `offline` covers powered off and
 * unplugged. `paused` is the Windows queue paused by hand. `error` is any other error flag (jam,
 * door, generic). `not-found` means no queue whose name contains `DS-RX1`. `unknown` means the
 * state could not be read: the UI says the driver did not report it instead of guessing.
 */
export const printerStatusSchema = z.discriminatedUnion('kind', [
  z.strictObject({ kind: z.literal('ready') }),
  z.strictObject({ kind: z.literal('offline') }),
  z.strictObject({ kind: z.literal('no-paper') }),
  z.strictObject({ kind: z.literal('no-ribbon') }),
  z.strictObject({ kind: z.literal('paused') }),
  z.strictObject({ kind: z.literal('error'), detail: z.string().max(1000) }),
  z.strictObject({ kind: z.literal('not-found') }),
  z.strictObject({ kind: z.literal('unknown'), detail: z.string().max(1000) }),
])

/**
 * Why `Imprimir` did not finish: a printer state (DESIGN §10), the cut the driver would not set,
 * a send that failed with no state reported (`unreported`), any other failure, or the JPG could
 * not be written.
 */
export const printFailureReasonSchema = z.enum([
  'offline',
  'no-paper',
  'no-ribbon',
  'paused',
  'printer-error',
  'not-found',
  'cut-unavailable',
  'unreported',
  'failed',
  'save-failed',
])

/**
 * Where the round is. `capturing` until the third photo, then `review` (the TV print screen),
 * `printing`, and `printed` or `print-failed`. `fileName` is the montage already in the event
 * folder: a failed send keeps it, and trying again resends it instead of writing another.
 */
export const roundPhaseSchema = z.discriminatedUnion('kind', [
  z.strictObject({ kind: z.literal('capturing') }),
  z.strictObject({ kind: z.literal('review') }),
  z.strictObject({ kind: z.literal('printing') }),
  z.strictObject({ kind: z.literal('printed'), fileName: z.string().min(1) }),
  z.strictObject({
    kind: z.literal('print-failed'),
    reason: printFailureReasonSchema,
    detail: z.string().max(1000),
    fileName: z.string().min(1).nullable(),
  }),
])

/** How the operator framed the photo inside one slot of the round (RF09, DESIGN §8). */
export const framingSchema = z.strictObject({
  zoom: z.number().finite().min(ZOOM_RANGE.min).max(ZOOM_RANGE.max),
  panX: z.number().finite().min(-1).max(1),
  panY: z.number().finite().min(-1).max(1),
  rotation: z.number().finite().min(FRAMING_ROTATION_RANGE.min).max(FRAMING_ROTATION_RANGE.max),
}) satisfies z.ZodType<Framing>

/** Main is the source of truth for the event and its round; both windows render this (DESIGN §2). */
export const sessionStateSchema = z.discriminatedUnion('kind', [
  z.strictObject({ kind: z.literal('idle') }),
  z.strictObject({
    kind: z.literal('event'),
    name: z.string().min(1).max(EVENT_NAME_MAX_LENGTH),
    mode: printModeSchema,
    timer: timerSchema,
    copies: copiesSchema,
    /** Photos taken in this round, 0 to 3. */
    taken: z.number().int().min(0).max(3),
    /** Bumps every time a new montage preview is ready; `session:get-preview` returns it. */
    previewRevision: z.number().int().nonnegative(),
    /** The slots of the event's mode, for the laptop guide. */
    slots: slotListSchema,
    /** The round's framing per slot id; a slot missing here has the default framing (RF09). */
    framings: z.record(z.string().min(1).max(32), framingSchema),
    phase: roundPhaseSchema,
  }),
])

export const eventStartInputSchema = z.strictObject({
  name: z.string().max(200),
  mode: printModeSchema,
  /** The operator confirmed the landscape-TV warning (RF04). */
  allowLandscape: z.boolean(),
})

export const eventStartErrorSchema = z.enum(['invalid-name', 'missing', 'landscape', 'folder-failed', 'already-open'])

export const eventStartResultSchema = z.discriminatedUnion('ok', [
  z.strictObject({ ok: z.literal(true), session: sessionStateSchema }),
  z.strictObject({ ok: z.literal(false), reason: eventStartErrorSchema }),
])

export const setTimerInputSchema = z.strictObject({ timer: timerSchema })
export const setCopiesInputSchema = z.strictObject({ copies: copiesSchema })
/** `session:set-framing`: pan, zoom and rotation of one slot of the round (RF09). */
export const setFramingInputSchema = z.strictObject({ slotId: z.string().min(1).max(32), framing: framingSchema })

/** `session:photo`: the TV's capture for photo `index`, already rotated and mirrored. */
export const sessionPhotoSchema = z.strictObject({
  index: photoIndexSchema,
  jpeg: bytesSchema(MAX_CAPTURE_BYTES),
})

export const sessionPreviewSchema = z.strictObject({
  revision: z.number().int().nonnegative(),
  jpeg: bytesSchema(MAX_PREVIEW_BYTES).nullable(),
})

/** Payload of `session:shutter`, main → TV. Empty: the TV runs its own timer and capture. */
export const shutterSchema = z.strictObject({})

// ── Webcam adjustments (PRD §6.7, RF15; DESIGN §5) ───────────────────────────

const webcamControlIdSchema = z.enum(WEBCAM_CONTROL_IDS)
const whiteBalanceModeSchema = z.enum(WHITE_BALANCE_MODES)

export const webcamRangeSchema = z
  .strictObject({ key: z.string().min(1).max(64), min: z.number().finite(), max: z.number().finite(), step: z.number().finite().positive() })
  .refine((range) => range.max > range.min, 'Expected max > min')

export const webcamCapabilitiesSchema = z.strictObject({
  controls: z.partialRecord(webcamControlIdSchema, webcamRangeSchema),
  whiteBalanceModes: z.array(whiteBalanceModeSchema).max(2),
  powerLineFrequency: z.boolean(),
}) satisfies z.ZodType<WebcamCapabilities>

export const webcamValuesSchema = z.strictObject({
  controls: z.partialRecord(webcamControlIdSchema, z.number().finite()),
  whiteBalanceMode: whiteBalanceModeSchema.optional(),
}) satisfies z.ZodType<WebcamValues>

/**
 * `webcam:get` output and `webcam:state` payload. `capabilities` is what the camera last advertised
 * (persisted, so the panel opens with the saved controls even with no camera, RF15); `live` says
 * whether the TV has the camera open right now.
 */
export const webcamStateSchema = z.strictObject({
  values: webcamValuesSchema,
  capabilities: webcamCapabilitiesSchema.nullable(),
  live: z.boolean(),
})

export const webcamSetInputSchema = z.strictObject({ values: webcamValuesSchema })

/** `webcam:report`, TV → main: the open camera's capabilities, or `null` when it is not open. */
export const webcamReportSchema = z.strictObject({ capabilities: webcamCapabilitiesSchema.nullable() })

export type WebcamState = z.infer<typeof webcamStateSchema>
export type WebcamReport = z.infer<typeof webcamReportSchema>

// ── Gallery (PRD §6.6, RF14) ─────────────────────────────────────────────────

/** A montage name this app writes (`HH-mm-ss.jpg`); never a path. */
export const montageFileNameSchema = z.string().max(32).refine(isMontageFileName, 'Expected an HH-mm-ss.jpg montage name')

/** `gallery:list` output: the event folder's montages, newest first; empty with no event open. */
export const galleryListSchema = z.strictObject({ fileNames: z.array(montageFileNameSchema).max(10_000) })

export const galleryGetInputSchema = z.strictObject({ fileName: montageFileNameSchema, size: z.enum(['thumb', 'full']) })

/** The montage JPEG, or `null` when the file is no longer there. The file itself is about 1 MB. */
export const galleryImageSchema = z.strictObject({ jpeg: bytesSchema(40 * 1024 * 1024).nullable() })

export const galleryReprintInputSchema = z.strictObject({ fileName: montageFileNameSchema })

/** `gallery:reprint` output: sent, or why not (a print failure, or `missing` when the file is gone or no event is open). */
export const galleryReprintResultSchema = z.discriminatedUnion('ok', [
  z.strictObject({ ok: z.literal(true) }),
  z.strictObject({ ok: z.literal(false), reason: z.union([printFailureReasonSchema, z.literal('missing')]), detail: z.string().max(1000) }),
])

/** `gallery:changed`, main → both windows, after a montage is written. */
export const galleryChangedSchema = z.strictObject({})

export type GalleryList = z.infer<typeof galleryListSchema>
export type GalleryGetInput = z.infer<typeof galleryGetInputSchema>
export type GalleryImage = z.infer<typeof galleryImageSchema>
export type GalleryReprintResult = z.infer<typeof galleryReprintResultSchema>

export type Timer = z.infer<typeof timerSchema>
export type PrintFailureReason = z.infer<typeof printFailureReasonSchema>
export type PrinterStatus = z.infer<typeof printerStatusSchema>
export type RoundPhase = z.infer<typeof roundPhaseSchema>
export type SessionState = z.infer<typeof sessionStateSchema>
export type EventSession = Extract<SessionState, { kind: 'event' }>
export type EventStartInput = z.infer<typeof eventStartInputSchema>
export type EventStartError = z.infer<typeof eventStartErrorSchema>
export type EventStartResult = z.infer<typeof eventStartResultSchema>
export type SessionPhoto = z.infer<typeof sessionPhotoSchema>
export type SetFramingInput = z.infer<typeof setFramingInputSchema>
export type SessionPreview = z.infer<typeof sessionPreviewSchema>
