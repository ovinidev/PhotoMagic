import sharp, { type OverlayOptions } from 'sharp'
import { SHEET } from '@shared/constants'
import { DEFAULT_FRAMING, clipToSheet, planSlot, type Framing, type PhotoIndex, type Slot } from '@shared/layout'

/** JPEG quality of the montage file (DESIGN §6). */
export const MONTAGE_JPEG_QUALITY = 95
/** Width of the preview JPEG the laptop and the TV show; the same composition, scaled down. */
export const PREVIEW_WIDTH = 922
const PREVIEW_JPEG_QUALITY = 82

export type SheetInput = {
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
 * Composes the sheet (DESIGN §6): each slot's photo, cover-fitted, rotated and clipped by the pure
 * `planSlot`/`clipToSheet`, over the mode's template. `montage` is the file: JPEG quality 95,
 * 1844×1240, 300 DPI. `preview` is the same composition scaled to 922 px wide.
 */
export async function renderSheet(input: SheetInput, output: SheetOutput): Promise<Buffer> {
  const layers: OverlayOptions[] = []
  const sizes = new Map<PhotoIndex, { width: number; height: number }>()

  for (const slot of input.slots) {
    if (slot.photo === null) continue
    const photo = input.photos[slot.photo]
    if (!photo) continue
    let size = sizes.get(slot.photo)
    if (!size) {
      const meta = await sharp(photo).metadata()
      size = { width: meta.width, height: meta.height }
      sizes.set(slot.photo, size)
    }
    const layer = await renderSlot(photo, planSlot(slot, size, input.framings?.[slot.id] ?? DEFAULT_FRAMING))
    if (layer) layers.push(layer)
  }

  const base = input.template
    ? sharp(input.template).resize(SHEET.width, SHEET.height, { fit: 'fill' })
    : sharp({ create: { width: SHEET.width, height: SHEET.height, channels: 3, background: '#ffffff' } })
  const sheet = await base
    .composite(layers)
    .flatten({ background: '#ffffff' })
    .raw()
    .toBuffer({ resolveWithObject: true })

  const composed = sharp(sheet.data, { raw: rawOf(sheet) })
  if (output.kind === 'preview') {
    return composed.resize({ width: PREVIEW_WIDTH }).jpeg({ quality: PREVIEW_JPEG_QUALITY }).toBuffer()
  }
  return composed
    .jpeg({ quality: MONTAGE_JPEG_QUALITY, chromaSubsampling: '4:4:4' })
    .withMetadata({ density: SHEET.dpi })
    .toBuffer()
}

/**
 * Runs one slot plan. Each step is materialized before the next, because sharp otherwise reorders
 * rotate, resize and extract inside a single pipeline.
 */
async function renderSlot(photo: Uint8Array, plan: ReturnType<typeof planSlot>): Promise<OverlayOptions | null> {
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

  const clip = clipToSheet(plan.center, rotated.info)
  if (!clip) return null
  const kept = await sharp(rotated.data, { raw: rawOf(rotated) }).extract(clip.source).raw().toBuffer({ resolveWithObject: true })
  return { input: kept.data, raw: rawOf(kept), left: clip.target.left, top: clip.target.top }
}

function rawOf(image: Raw): { width: number; height: number; channels: 1 | 2 | 3 | 4 } {
  return { width: image.info.width, height: image.info.height, channels: image.info.channels as 1 | 2 | 3 | 4 }
}
