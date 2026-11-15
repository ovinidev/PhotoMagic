/**
 * Webcam adjustments (PRD §4.7, §6.7, RF15; DESIGN §5 Constraints). Pure: the TV reads
 * `track.getCapabilities()` and hands the raw object here; the result is what the panel draws and
 * what `applyConstraints` receives. No React, no Electron, no DOM types.
 */

/** The controls the panel may draw, in its order. Hue, gamma and "enable color" are not here (PRD §6.7). */
export const WEBCAM_CONTROL_IDS = ['brightness', 'contrast', 'saturation', 'sharpness', 'colorTemperature', 'gain', 'backlightCompensation'] as const
export type WebcamControlId = (typeof WEBCAM_CONTROL_IDS)[number]

/**
 * The capability names each control may use, first match wins. Gain is `gain`, or `iso` where the
 * camera stack names the same setting that way (DESIGN §5: "whatever name the capability uses").
 */
export const WEBCAM_CAPABILITY_KEYS: Record<WebcamControlId, readonly string[]> = {
  brightness: ['brightness'],
  contrast: ['contrast'],
  saturation: ['saturation'],
  sharpness: ['sharpness'],
  colorTemperature: ['colorTemperature'],
  gain: ['gain', 'iso'],
  backlightCompensation: ['backlightCompensation'],
}

export const WHITE_BALANCE_MODES = ['continuous', 'manual'] as const
export type WhiteBalanceMode = (typeof WHITE_BALANCE_MODES)[number]

/** Power-line frequency is fixed at 60 Hz when the camera exposes it, with no control (PRD §6.7). */
export const POWER_LINE_FREQUENCY_HZ = 60

export type WebcamRange = { key: string; min: number; max: number; step: number }

/** What the camera advertises, reduced to the controls the app draws. */
export type WebcamCapabilities = {
  controls: Partial<Record<WebcamControlId, WebcamRange>>
  /** The white balance modes the camera offers among `continuous` and `manual`. */
  whiteBalanceModes: WhiteBalanceMode[]
  powerLineFrequency: boolean
}

/** What the operator set, persisted in `config.json` (RNF11). */
export type WebcamValues = {
  controls: Partial<Record<WebcamControlId, number>>
  whiteBalanceMode?: WhiteBalanceMode | undefined
}

export const NO_WEBCAM_CAPABILITIES: WebcamCapabilities = { controls: {}, whiteBalanceModes: [], powerLineFrequency: false }
export const NO_WEBCAM_VALUES: WebcamValues = { controls: {} }

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null

function readRange(raw: unknown): { min: number; max: number; step: number } | null {
  if (!isRecord(raw)) return null
  const { min, max, step } = raw
  if (typeof min !== 'number' || typeof max !== 'number' || !Number.isFinite(min) || !Number.isFinite(max) || max <= min) return null
  return { min, max, step: typeof step === 'number' && step > 0 && Number.isFinite(step) ? step : 1 }
}

/**
 * The controls a camera's `getCapabilities()` exposes. A control without a usable `{ min, max }`
 * range is left out, so the panel does not draw it (RF15). Backlight only appears when it exists.
 */
export function readWebcamCapabilities(raw: unknown): WebcamCapabilities {
  if (!isRecord(raw)) return NO_WEBCAM_CAPABILITIES
  const controls: WebcamCapabilities['controls'] = {}
  for (const id of WEBCAM_CONTROL_IDS) {
    for (const key of WEBCAM_CAPABILITY_KEYS[id]) {
      const range = readRange(raw[key])
      if (range) {
        controls[id] = { key, ...range }
        break
      }
    }
  }
  const modes = Array.isArray(raw.whiteBalanceMode) ? raw.whiteBalanceMode : []
  return {
    controls,
    whiteBalanceModes: WHITE_BALANCE_MODES.filter((mode) => modes.includes(mode)),
    powerLineFrequency: raw.powerLineFrequency !== undefined,
  }
}

/** `value` inside the range, on its step. */
export function clampToRange(value: number, range: { min: number; max: number; step: number }): number {
  const bounded = Math.min(range.max, Math.max(range.min, value))
  const stepped = range.min + Math.round((bounded - range.min) / range.step) * range.step
  return Math.min(range.max, Math.round(stepped * 1e6) / 1e6)
}

/** Whether the color temperature control applies: only in manual white balance, when the camera has modes. */
export function colorTemperatureApplies(values: WebcamValues, capabilities: WebcamCapabilities): boolean {
  return capabilities.whiteBalanceModes.length === 0 || values.whiteBalanceMode === 'manual'
}

/**
 * The constraint set for `applyConstraints({ advanced: [set] })`: each saved value the camera
 * supports, clamped to its range, under the capability's own name; the white balance mode; and
 * 60 Hz power-line frequency when it exists. Values the camera does not support are skipped.
 */
export function webcamConstraintSet(values: WebcamValues, capabilities: WebcamCapabilities): Record<string, number | string> {
  const set: Record<string, number | string> = {}
  const mode = values.whiteBalanceMode
  if (mode && capabilities.whiteBalanceModes.includes(mode)) set.whiteBalanceMode = mode
  for (const id of WEBCAM_CONTROL_IDS) {
    const range = capabilities.controls[id]
    const value = values.controls[id]
    if (!range || value === undefined) continue
    if (id === 'colorTemperature' && !colorTemperatureApplies(values, capabilities)) continue
    set[range.key] = clampToRange(value, range)
  }
  if (capabilities.powerLineFrequency) set.powerLineFrequency = POWER_LINE_FREQUENCY_HZ
  return set
}
