/**
 * Picks the PrintTicket settings for a montage from the queue's PrintCapabilities (DESIGN §10).
 * The helper reads the capabilities XML and hands back every feature and option as qualified names;
 * the choice happens here, in pure code, so it is unit-tested without a driver.
 */

/** Print Schema Keywords namespace: the standard features (media size, orientation, resolution). */
export const PSK = 'http://schemas.microsoft.com/windows/2003/08/printing/printschemakeywords'

export type QName = { ns: string; name: string }

export type CapabilityOption = QName & {
  displayName: string | null
  /** Numeric scored properties in the PSK namespace, by local name (`MediaSizeWidth`, `ResolutionX`…). */
  scored: Record<string, number>
}

export type CapabilityFeature = QName & { displayName: string | null; options: CapabilityOption[] }

export type Capabilities = { features: CapabilityFeature[] }

export type SettingRole = 'cut' | 'media' | 'orientation' | 'resolution'

/**
 * One feature/option pair for the delta ticket. A `required` setting that the driver changes while
 * validating the ticket stops the print before anything is spooled.
 */
export type TicketSetting = { role: SettingRole; feature: QName; option: QName; required: boolean }

export type TicketPlan =
  | { ok: true; settings: TicketSetting[] }
  | { ok: false; reason: 'cut-unavailable' | 'failed'; detail: string }

/** 6.00" × 4.00" in microns, the unit of `MediaSizeWidth` and `MediaSizeHeight`. */
const SIX_BY_FOUR = { long: 152_400, short: 101_600 }
/** DNP sizes can carry a little bleed; anything this close to 6×4 is that paper. */
const MEDIA_TOLERANCE = 5_000

const label = (item: { name: string; displayName: string | null }) => `${item.displayName ?? ''} ${item.name}`
const isPsk = (item: QName, name: string) => item.ns === PSK && item.name === name
const describe = (item: { name: string; displayName: string | null }) => item.displayName ?? item.name
const qname = ({ ns, name }: QName): QName => ({ ns, name })

/**
 * The DS-RX1 shows the cut as `2inch cut`, with `Disable` and `Enable (Printer V.1.10 or later)`.
 * A feature named like that wins; otherwise a single private feature mentioning "cut" is accepted.
 * Two candidates, or none, and the cut cannot be set: the sheet must not come out cut by accident.
 */
export function findCutFeature(capabilities: Capabilities): { ok: true; feature: CapabilityFeature } | { ok: false; detail: string } {
  const named = capabilities.features.filter((feature) => /2\s*-?\s*(inch|in\b|")\s*-?\s*cut/i.test(label(feature)))
  const candidates = named.length > 0 ? named : capabilities.features.filter((feature) => feature.ns !== PSK && /cut/i.test(label(feature)))
  if (candidates.length === 1) return { ok: true, feature: candidates[0]! }
  if (candidates.length === 0) return { ok: false, detail: 'the driver does not expose a 2inch cut setting' }
  return { ok: false, detail: `more than one cut setting in the driver: ${candidates.map(describe).join(', ')}` }
}

/** `Enable…` for the cut on, `Disable` for the cut off; exactly one option must match. */
export function chooseCutOption(feature: CapabilityFeature, cut: boolean): { ok: true; option: CapabilityOption } | { ok: false; detail: string } {
  const isOff = (option: CapabilityOption) => /disable|\boff\b|\bnone\b/i.test(label(option))
  const isOn = (option: CapabilityOption) => !isOff(option) && /enable|\bon\b/i.test(label(option))
  const matches = feature.options.filter(cut ? isOn : isOff)
  const wanted = cut ? 'Enable' : 'Disable'
  if (matches.length === 1) return { ok: true, option: matches[0]! }
  const offered = feature.options.map(describe).join(', ') || 'none'
  return { ok: false, detail: `${describe(feature)}: no single ${wanted} option (offered: ${offered})` }
}

/**
 * The PageMediaSize option closest to 6×4, either way round, within the tolerance. The DS-RX1 lists
 * the same paper twice, `PR (4x6)` (tall) and `PC (6x4)` (wide), plus `x 2` variants that split the
 * sheet: the wide one comes first, because the montage is 1844×1240 and the helper never rotates it
 * (a tall page fails with "driver page is 413x615"), and an `x 2` variant comes last.
 */
/** Lexicographic order of two ranks: the first differing entry decides. */
function before(a: readonly number[], b: readonly number[]): boolean {
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return a[i]! < b[i]!
  return false
}

export function chooseMedia(capabilities: Capabilities): CapabilityOption | null {
  const feature = capabilities.features.find((candidate) => isPsk(candidate, 'PageMediaSize'))
  if (!feature) return null
  let best: { option: CapabilityOption; rank: [number, number, number] } | null = null
  for (const option of feature.options) {
    const width = option.scored['MediaSizeWidth']
    const height = option.scored['MediaSizeHeight']
    if (width === undefined || height === undefined) continue
    const distance = Math.max(Math.abs(Math.max(width, height) - SIX_BY_FOUR.long), Math.abs(Math.min(width, height) - SIX_BY_FOUR.short))
    if (distance > MEDIA_TOLERANCE) continue
    const split = /x\s*2\b/i.test(`${option.name} ${option.displayName ?? ''}`) ? 1 : 0
    const rank: [number, number, number] = [split, width >= height ? 0 : 1, distance]
    if (!best || before(rank, best.rank)) best = { option, rank }
  }
  return best?.option ?? null
}

/** 300×300 DPI, when the driver offers it as a named option; otherwise the driver's own resolution stays. */
export function chooseResolution(capabilities: Capabilities): CapabilityOption | null {
  const feature = capabilities.features.find((candidate) => isPsk(candidate, 'PageResolution'))
  return feature?.options.find((option) => option.scored['ResolutionX'] === 300 && option.scored['ResolutionY'] === 300) ?? null
}

function setting(role: SettingRole, feature: QName, option: QName, required: boolean): TicketSetting {
  return { role, feature: qname(feature), option: qname(option), required }
}

/**
 * Everything the ticket asks for (RF11): the cut on or off, 6×4 paper and Portrait (the bitmap is
 * not rotated again), required; 300 DPI when offered. The cut is checked first, because that
 * failure has its own message on the TV and the laptop.
 */
export function planTicket(capabilities: Capabilities, cut: boolean): TicketPlan {
  const cutFeature = findCutFeature(capabilities)
  if (!cutFeature.ok) return { ok: false, reason: 'cut-unavailable', detail: cutFeature.detail }
  const cutOption = chooseCutOption(cutFeature.feature, cut)
  if (!cutOption.ok) return { ok: false, reason: 'cut-unavailable', detail: cutOption.detail }

  const media = chooseMedia(capabilities)
  if (!media) return { ok: false, reason: 'failed', detail: 'the driver does not offer 6x4 paper' }

  const orientationFeature = capabilities.features.find((candidate) => isPsk(candidate, 'PageOrientation'))
  const portrait = orientationFeature?.options.find((option) => isPsk(option, 'Portrait'))
  if (!orientationFeature || !portrait) return { ok: false, reason: 'failed', detail: 'the driver does not offer Portrait orientation' }

  const settings = [
    setting('cut', cutFeature.feature, cutOption.option, true),
    setting('media', { ns: PSK, name: 'PageMediaSize' }, media, true),
    setting('orientation', orientationFeature, portrait, true),
  ]
  const resolution = chooseResolution(capabilities)
  if (resolution) settings.push(setting('resolution', { ns: PSK, name: 'PageResolution' }, resolution, false))
  return { ok: true, settings }
}
