import { z } from 'zod'
import type { DisplayInfo, GuestChoice } from '../displays'

/** `app:get-version` takes no input. */
export const appGetVersionInputSchema = z.undefined()

/** `app:get-version` output: the `package.json` version and whether the app runs under E2E. */
export const appVersionSchema = z.strictObject({
  version: z.string().regex(/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/, 'Expected a semver version'),
  e2e: z.boolean(),
})

export type AppVersion = z.infer<typeof appVersionSchema>

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
