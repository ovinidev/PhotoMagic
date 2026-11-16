import sharp, { type OverlayOptions } from 'sharp'
import { SHEET } from '@shared/constants'
import { DEFAULT_FRAMING, clipToSheet, fixedBox, onSeed, planSlot, type Framing, type GuideBox, type PhotoIndex, type PrintMode, type Slot } from '@shared/layout'

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
}

export type SheetOutput = { kind: 'montage' } | { kind: 'preview' }

type Raw = { data: Buffer; info: { width: number; height: number; channels: number } }

/**
 * Composes the sheet (DESIGN §6): each slot's photo, cover-fitted and rotated by the pure `planSlot`,
 * over the mode's template, clipped to the slot's fixed gray box (`fixedBox`, rounded corners
 * included). The slot only places the photo; whatever falls outside its box is dropped, and where
 * the slot does not cover its box the box shows the same photo cover-fitted to the box (the seed
 * slot's plan, with the same framing), so no template shows inside a box. `montage` is the file:
 * JPEG quality 95, 1844×1240, 300 DPI. `preview` is the same composition scaled to 922 px wide.
 */
export async function renderSheet(input: SheetInput, output: SheetOutput): Promise<Buffer> {
  const sheet = await composeSheet(input)
  const composed = sharp(sheet.data, { raw: rawOf(sheet) })
  if (output.kind === 'preview') {
    return composed.resize({ width: PREVIEW_WIDTH }).jpeg({ quality: PREVIEW_JPEG_QUALITY }).toBuffer()
  }
  return composed
    .jpeg({ quality: MONTAGE_JPEG_QUALITY, chromaSubsampling: '4:4:4' })
    .withMetadata({ density: SHEET.dpi })
    .toBuffer()
}

/** The composed sheet as raw RGB pixels, before encoding (exported for the pixel tests). */
export async function composeSheet(input: SheetInput): Promise<Raw> {
  const layers: OverlayOptions[] = []
  const sizes = new Map<PhotoIndex, { width: number; height: number }>()

  for (const [index, slot] of input.slots.entries()) {
    if (slot.photo === null) continue
    const photo = input.photos[slot.photo]
    if (!photo) continue
    const fixed = fixedBox(input.mode, slot.id, index)
    if (!fixed) continue
    let size = sizes.get(slot.photo)
    if (!size) {
      const meta = await sharp(photo).metadata()
      size = { width: meta.width, height: meta.height }
      sizes.set(slot.photo, size)
    }
    const framing = input.framings?.[slot.id] ?? DEFAULT_FRAMING
    const plans = onSeed(slot, fixed.seedSlot) ? [planSlot(slot, size, framing)] : [planSlot(fixed.seedSlot, size, framing), planSlot(slot, size, framing)]
    const layer = await renderBox(photo, plans, fixed.box)
    if (layer) layers.push(layer)
  }

  const base = input.template
    ? sharp(input.template).resize(SHEET.width, SHEET.height, { fit: 'fill' })
    : sharp({ create: { width: SHEET.width, height: SHEET.height, channels: 3, background: '#ffffff' } })
  // sharp runs `composite` after every other step of a pipeline, so flatten in a second one: plain RGB.
  const composed = await base.composite(layers).raw().toBuffer({ resolveWithObject: true })
  return sharp(composed.data, { raw: rawOf(composed) }).flatten({ background: '#ffffff' }).raw().toBuffer({ resolveWithObject: true })
}

/**
 * One fixed box: the plans' tiles (cover underlay first, the slot's photo on top) drawn on a
 * transparent canvas the size of the box, cut to its rounded rectangle, placed on the sheet.
 */
async function renderBox(photo: Uint8Array, plans: readonly ReturnType<typeof planSlot>[], box: GuideBox): Promise<OverlayOptions | null> {
  const left = Math.round(box.rect.left)
  const top = Math.round(box.rect.top)
  const size = { width: Math.round(box.rect.width), height: Math.round(box.rect.height) }
  const tiles: OverlayOptions[] = []
  for (const plan of plans) {
    const tile = await renderSlot(photo, plan)
    const clip = clipToSheet({ x: plan.center.x - left, y: plan.center.y - top }, tile.info, size)
    if (!clip) continue
    const kept = await sharp(tile.data, { raw: rawOf(tile) }).extract(clip.source).raw().toBuffer({ resolveWithObject: true })
    tiles.push({ input: kept.data, raw: rawOf(kept), left: clip.target.left, top: clip.target.top })
  }
  if (tiles.length === 0) return null
  const radius = Math.max(0, Math.min(box.radius, size.width / 2, size.height / 2))
  const mask = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${size.width}" height="${size.height}"><rect width="${size.width}" height="${size.height}" rx="${radius}" ry="${radius}" fill="#fff"/></svg>`)
  const drawn = await sharp({ create: { ...size, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
    .composite(tiles)
    .png()
    .toBuffer()
  const masked = await sharp(drawn).composite([{ input: mask, blend: 'dest-in' }]).raw().toBuffer({ resolveWithObject: true })
  // The box itself may stick out of the sheet; keep only the part on it.
  const clip = clipToSheet({ x: left + size.width / 2, y: top + size.height / 2 }, size)
  if (!clip) return null
  const kept = await sharp(masked.data, { raw: rawOf(masked) }).extract(clip.source).raw().toBuffer({ resolveWithObject: true })
  return { input: kept.data, raw: rawOf(kept), left: clip.target.left, top: clip.target.top }
}

/**
 * Runs one slot plan into its turned tile, to be centered at `plan.center`. Each step is materialized before the next, because sharp otherwise reorders
 * rotate, resize and extract inside a single pipeline.
 */
async function renderSlot(photo: Uint8Array, plan: ReturnType<typeof planSlot>): Promise<Raw> {
  const turned = plan.preRotate === 0 ? photo : await sharp(photo).rotate(plan.preRotate).toBuffer()
  const resized = await sharp(turned).resize(plan.resize.width, plan.resize.height, { fit: 'fill' }).toBuffer()
  let tile = sharp(resized).extract(plan.extract).ensureAlpha()
  if (plan.rotate !== 0) {
    // The framing rotation (RF09): turn the oversized tile, then keep the slot box from its center.
    const turned = await sharp(await tile.png().toBuffer())
      .rotate(plan.rotate, { background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .png()
      .toBuffer({ resolveWithObject: true })
    const left = Math.max(0, Math.floor((turned.info.width - plan.box.width) / 2))
    const top = Math.max(0, Math.floor((turned.info.height - plan.box.height) / 2))
    tile = sharp(await sharp(turned.data).extract({ left, top, width: plan.box.width, height: plan.box.height }).png().toBuffer()).ensureAlpha()
  }
  if (plan.radius > 0) {
    // The artwork's rounded photo box: keep the tile inside a rounded rectangle of the same radius.
    // Done before the slot's turn, in the box's own axes; a rounded rectangle turns into itself.
    const { width, height } = plan.box
    const mask = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}"><rect width="${width}" height="${height}" rx="${plan.radius}" ry="${plan.radius}" fill="#fff"/></svg>`)
    tile = sharp(await tile.composite([{ input: mask, blend: 'dest-in' }]).png().toBuffer()).ensureAlpha()
  }
  const rotated: Raw =
    plan.angle === 0
      ? await tile.raw().toBuffer({ resolveWithObject: true })
      : await sharp(await tile.png().toBuffer())
          .rotate(plan.angle, { background: { r: 0, g: 0, b: 0, alpha: 0 } })
          .ensureAlpha()
          .raw()
          .toBuffer({ resolveWithObject: true })

  return rotated
}

function rawOf(image: Raw): { width: number; height: number; channels: 1 | 2 | 3 | 4 } {
  return { width: image.info.width, height: image.info.height, channels: image.info.channels as 1 | 2 | 3 | 4 }
}
