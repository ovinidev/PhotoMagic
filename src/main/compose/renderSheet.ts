import sharp, { type OverlayOptions, type Sharp } from 'sharp'
import { SHEET } from '@shared/constants'
import { DEFAULT_FRAMING, clipToSheet, photoInBox, planSlot, type Framing, type GuideBox, type PhotoIndex, type PrintMode, type Slot, type SlotPlan } from '@shared/layout'

/** JPEG quality of the montage file (DESIGN §6). */
export const MONTAGE_JPEG_QUALITY = 95
/** Width of the preview JPEG the laptop and the TV show; the same composition, scaled down. */
export const PREVIEW_WIDTH = 922
const PREVIEW_JPEG_QUALITY = 82

export type SheetInput = {
  /** The event's mode: its gray guide boxes are the fixed masks every photo is clipped to. */
  mode: PrintMode
  /** The mode's 1844×1240 background, PNG or JPEG. `null` paints the sheet white. */
  template: Uint8Array | null
  slots: readonly Slot[]
  /** The round's captures, already upright and mirrored by the TV. A missing photo leaves its slots empty. */
  photos: Partial<Record<PhotoIndex, Uint8Array>>
  /** Per-slot framing by slot id; a missing entry is the default (zoom 1, centered). */
  framings?: Readonly<Record<string, Framing>>
  /** The template's own dark boxes (`detectTemplateBoxes`), used as the fixed boxes; `null` or missing uses the seed's. */
  boxes?: readonly GuideBox[] | null
}

export type SheetOutput = { kind: 'montage' } | { kind: 'preview' }

type Raw = { data: Buffer; info: { width: number; height: number; channels: number } }

/**
 * Composes the sheet (DESIGN §6): exactly one photo per fixed box (`photoInBox`: the template's
 * detected dark box, or the seed's gray box), planned on the box by the pure `planSlot` with the
 * round's framing, so it covers the whole box, and clipped to the box's rounded corners. The card
 * only turns the photo; its size and position never leave a gap or a second copy. `montage` is the file:
 * JPEG quality 95, 1844×1240, 300 DPI. `preview` is the same composition at 922 px wide.
 */
export async function renderSheet(input: SheetInput, output: SheetOutput): Promise<Buffer> {
  if (output.kind === 'preview') {
    // Composed at preview size from the start (DESIGN §6): the same plan with every sheet length
    // scaled, about a quarter of the pixels of composing at 1844 px and scaling down.
    const sheet = await composeSheet(input, PREVIEW_WIDTH / SHEET.width)
    return sharp(sheet.data, { raw: rawOf(sheet) }).jpeg({ quality: PREVIEW_JPEG_QUALITY }).toBuffer()
  }
  const sheet = await composeSheet(input)
  return sharp(sheet.data, { raw: rawOf(sheet) })
    .jpeg({ quality: MONTAGE_JPEG_QUALITY, chromaSubsampling: '4:4:4' })
    .withMetadata({ density: SHEET.dpi })
    .toBuffer()
}

const TRANSPARENT = { r: 0, g: 0, b: 0, alpha: 0 }

/** A slot or box scaled about the sheet origin. Framing pan and zoom are relative, so the plan scales with it. */
const scaleSlot = (slot: Slot, s: number): Slot => ({
  ...slot,
  left: slot.left * s,
  top: slot.top * s,
  width: slot.width * s,
  height: slot.height * s,
  radius: slot.radius === undefined ? undefined : slot.radius * s,
})
const scaleBox = (box: GuideBox, s: number): GuideBox => ({
  ...box,
  rect: { left: box.rect.left * s, top: box.rect.top * s, width: box.rect.width * s, height: box.rect.height * s },
  radius: box.radius * s,
})

/**
 * The composed sheet as raw RGB pixels, before encoding (exported for the pixel tests). `scale` 1 is
 * the 1844×1240 file; the preview passes 0.5 and gets the same composition at 922×620.
 */
export async function composeSheet(input: SheetInput, scale = 1): Promise<Raw> {
  const sheet = { width: Math.round(SHEET.width * scale), height: Math.round(SHEET.height * scale) }
  const layers: OverlayOptions[] = []
  // Each capture is decoded once per composition, however many boxes show it.
  const decoded = new Map<PhotoIndex, Raw>()

  for (const [index, slot] of input.slots.entries()) {
    if (slot.photo === null) continue
    const photo = input.photos[slot.photo]
    if (!photo) continue
    const placed = photoInBox(input.mode, slot, index, input.framings?.[slot.id] ?? DEFAULT_FRAMING, input.boxes)
    if (!placed) continue
    let pixels = decoded.get(slot.photo)
    if (!pixels) {
      pixels = await sharp(photo).raw().toBuffer({ resolveWithObject: true })
      decoded.set(slot.photo, pixels)
    }
    const plan = planSlot(scale === 1 ? placed.slot : scaleSlot(placed.slot, scale), pixels.info, placed.framing)
    const layer = await renderBox(pixels, plan, scale === 1 ? placed.box : scaleBox(placed.box, scale), sheet)
    if (layer) layers.push(layer)
  }

  const base = input.template
    ? sharp(input.template).resize(sheet.width, sheet.height, { fit: 'fill' })
    : sharp({ create: { ...sheet, channels: 3, background: '#ffffff' } })
  // sharp runs `composite` after every other step of a pipeline, so flatten in a second one: plain RGB.
  const composed = await base.composite(layers).raw().toBuffer({ resolveWithObject: true })
  return sharp(composed.data, { raw: rawOf(composed) }).flatten({ background: '#ffffff' }).raw().toBuffer({ resolveWithObject: true })
}

const roundedMask = (width: number, height: number, radius: number) =>
  Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}"><rect width="${width}" height="${height}" rx="${radius}" ry="${radius}" fill="#fff"/></svg>`)

/** Runs one sharp step on raw pixels and materializes it as raw pixels again. */
const step = (image: Raw, run: (pipeline: Sharp) => Sharp): Promise<Raw> =>
  run(sharp(image.data, { raw: rawOf(image) })).raw().toBuffer({ resolveWithObject: true })

/**
 * One fixed box: the plan's tile drawn on a transparent canvas the size of the box, cut to its
 * rounded rectangle, placed on the sheet.
 */
async function renderBox(photo: Raw, plan: SlotPlan, box: GuideBox, sheet: { width: number; height: number }): Promise<OverlayOptions | null> {
  const left = Math.round(box.rect.left)
  const top = Math.round(box.rect.top)
  const size = { width: Math.round(box.rect.width), height: Math.round(box.rect.height) }
  const tile = await renderSlot(photo, plan)
  const inBox = clipToSheet({ x: plan.center.x - left, y: plan.center.y - top }, tile.info, size)
  if (!inBox) return null
  const inside = await step(tile, (p) => p.extract(inBox.source))
  const tiles: OverlayOptions[] = [{ input: inside.data, raw: rawOf(inside), left: inBox.target.left, top: inBox.target.top }]
  const radius = Math.max(0, Math.min(box.radius, size.width / 2, size.height / 2))
  const drawn = await sharp({ create: { ...size, channels: 4, background: TRANSPARENT } })
    .composite(tiles)
    .raw()
    .toBuffer({ resolveWithObject: true })
  const masked = await step(drawn, (p) => p.composite([{ input: roundedMask(size.width, size.height, radius), blend: 'dest-in' }]))
  // The box itself may stick out of the sheet; keep only the part on it.
  const clip = clipToSheet({ x: left + size.width / 2, y: top + size.height / 2 }, size, sheet)
  if (!clip) return null
  const kept = await step(masked, (p) => p.extract(clip.source))
  return { input: kept.data, raw: rawOf(kept), left: clip.target.left, top: clip.target.top }
}

/**
 * Runs one slot plan into its turned tile, to be centered at `plan.center`. Each step is materialized
 * (as raw pixels) before the next, because sharp otherwise reorders rotate, resize and extract inside
 * a single pipeline.
 */
async function renderSlot(photo: Raw, plan: SlotPlan): Promise<Raw> {
  const turned = plan.preRotate === 0 ? photo : await step(photo, (p) => p.rotate(plan.preRotate))
  const resized = await step(turned, (p) => p.resize(plan.resize.width, plan.resize.height, { fit: 'fill' }))
  let tile = await step(resized, (p) => p.extract(plan.extract).ensureAlpha())
  if (plan.rotate !== 0) {
    // The framing rotation (RF09): turn the oversized tile, then keep the slot box from its center.
    const spun = await step(tile, (p) => p.rotate(plan.rotate, { background: TRANSPARENT }))
    const left = Math.max(0, Math.floor((spun.info.width - plan.box.width) / 2))
    const top = Math.max(0, Math.floor((spun.info.height - plan.box.height) / 2))
    tile = await step(spun, (p) => p.extract({ left, top, width: plan.box.width, height: plan.box.height }).ensureAlpha())
  }
  if (plan.radius > 0) {
    // The artwork's rounded photo box: keep the tile inside a rounded rectangle of the same radius.
    // Done before the slot's turn, in the box's own axes; a rounded rectangle turns into itself.
    const { width, height } = plan.box
    tile = await step(tile, (p) => p.composite([{ input: roundedMask(width, height, plan.radius), blend: 'dest-in' }]))
  }
  return plan.angle === 0 ? tile : step(tile, (p) => p.rotate(plan.angle, { background: TRANSPARENT }).ensureAlpha())
}

function rawOf(image: Raw): { width: number; height: number; channels: 1 | 2 | 3 | 4 } {
  return { width: image.info.width, height: image.info.height, channels: image.info.channels as 1 | 2 | 3 | 4 }
}
