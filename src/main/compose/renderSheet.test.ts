import sharp from 'sharp'
import { describe, expect, it } from 'vitest'
import { ONE_STRIP_SEED, TWO_STRIPS_SEED, clipToSheet, slotBounds, type PhotoIndex, type Slot } from '@shared/layout'
import { PREVIEW_WIDTH, renderSheet } from './renderSheet'

type Rgb = [number, number, number]

const GRAY: Rgb = [128, 128, 128]
const BAR: Rgb = [255, 255, 255]
/** Each photo's body color, so the test sees which capture landed in which slot. */
const BODY: Record<PhotoIndex, Rgb> = { 1: [200, 0, 0], 2: [0, 160, 0], 3: [0, 0, 200] }
const PHOTO = { width: 360, height: 640 }
/** The light bar covers the top 40% of the portrait: enough to survive the center crop of a horizontal slot. */
const BAR_FRACTION = 0.4

/** A portrait capture: light bar on top, the photo's color below (RF08 fixture frame). */
async function capture(photo: PhotoIndex): Promise<Buffer> {
  const bar = Math.round(PHOTO.height * BAR_FRACTION)
  const [r, g, b] = BODY[photo]
  return sharp({ create: { ...PHOTO, channels: 3, background: { r, g, b } } })
    .composite([{ input: { create: { width: PHOTO.width, height: bar, channels: 3, background: { r: 255, g: 255, b: 255 } } }, left: 0, top: 0 }])
    .jpeg({ quality: 95 })
    .toBuffer()
}

async function template(): Promise<Buffer> {
  return sharp({ create: { width: 1844, height: 1240, channels: 3, background: { r: 128, g: 128, b: 128 } } }).png().toBuffer()
}

async function pixels(jpeg: Buffer) {
  const { data, info } = await sharp(jpeg).raw().toBuffer({ resolveWithObject: true })
  return (x: number, y: number): Rgb => {
    const at = (Math.round(y) * info.width + Math.round(x)) * info.channels
    return [data[at]!, data[at + 1]!, data[at + 2]!]
  }
}

const near = (actual: Rgb, expected: Rgb) => actual.every((value, index) => Math.abs(value - expected[index]!) <= 30)

/** The visible part of a slot on the sheet, after rotation and clipping. */
function visible(slot: Slot) {
  const bounds = slotBounds(slot)
  const clip = clipToSheet({ x: bounds.left + bounds.width / 2, y: bounds.top + bounds.height / 2 }, bounds)!
  return { left: clip.target.left, top: clip.target.top, width: clip.source.width, height: clip.source.height, hiddenTop: clip.source.top, fullHeight: bounds.height }
}

async function allPhotos() {
  return { 1: await capture(1), 2: await capture(2), 3: await capture(3) }
}

describe('renderSheet (RF08, RF12)', () => {
  it('writes a 1844×1240 JPEG at 300 DPI', async () => {
    const jpeg = await renderSheet({ template: await template(), slots: TWO_STRIPS_SEED, photos: await allPhotos() }, { kind: 'montage' })
    const meta = await sharp(jpeg).metadata()
    expect(meta).toMatchObject({ format: 'jpeg', width: 1844, height: 1240, density: 300 })
  })

  it.each([
    ['two-strips', TWO_STRIPS_SEED],
    ['one-strip', ONE_STRIP_SEED],
  ] as const)('puts each photo upright in its slots, bar on top, in %s', async (_mode, slots) => {
    const jpeg = await renderSheet({ template: await template(), slots, photos: await allPhotos() }, { kind: 'montage' })
    const at = await pixels(jpeg)
    for (const slot of slots) {
      const box = visible(slot)
      const x = box.left + box.width / 2
      // Top of the slot (in the full rotated slot, 5% down) shows the bar; the lower part shows the photo's body.
      const topY = box.top - box.hiddenTop + box.fullHeight * 0.05
      const lowY = box.top - box.hiddenTop + box.fullHeight * 0.8
      expect(near(at(x, Math.max(box.top + 2, topY)), BAR), `${slot.id} top`).toBe(true)
      expect(near(at(x, lowY), BODY[slot.photo]), `${slot.id} body`).toBe(true)
      // Full width covered: the slot's own left and right edges show the photo, not the template.
      expect(near(at(box.left + 2, lowY), GRAY), `${slot.id} left edge`).toBe(false)
      expect(near(at(box.left + box.width - 3, lowY), GRAY), `${slot.id} right edge`).toBe(false)
    }
  })

  it('crops the center of the portrait in a horizontal slot: bar only in the top part', async () => {
    const jpeg = await renderSheet({ template: await template(), slots: TWO_STRIPS_SEED, photos: await allPhotos() }, { kind: 'montage' })
    const at = await pixels(jpeg)
    const bottom1 = TWO_STRIPS_SEED[3]!
    // Visible: 31.6% of the portrait height, from 34.2% to 65.8%. The bar (top 40%) fills its top 18%.
    const barRows = 281 * ((BAR_FRACTION - 0.342) / 0.316)
    expect(near(at(bottom1.left + 250, bottom1.top + barRows - 12), BAR)).toBe(true)
    expect(near(at(bottom1.left + 250, bottom1.top + barRows + 12), BODY[1])).toBe(true)
  })

  it('leaves the template visible where a photo is still missing', async () => {
    const jpeg = await renderSheet({ template: await template(), slots: TWO_STRIPS_SEED, photos: { 1: await capture(1) } }, { kind: 'montage' })
    const at = await pixels(jpeg)
    const top3 = visible(TWO_STRIPS_SEED[2]!)
    expect(near(at(top3.left + top3.width / 2, top3.top + top3.height / 2), GRAY)).toBe(true)
    const bottom1 = TWO_STRIPS_SEED[3]!
    expect(near(at(bottom1.left + 250, bottom1.top + 250), BODY[1])).toBe(true)
  })

  it('fills the one-strip sheet with no white half', async () => {
    const jpeg = await renderSheet({ template: await template(), slots: ONE_STRIP_SEED, photos: await allPhotos() }, { kind: 'montage' })
    const at = await pixels(jpeg)
    for (const x of [322, 922, 1522]) expect(near(at(x, 1000), [255, 255, 255])).toBe(false)
  })

  it('renders the preview from the same composition, scaled down', async () => {
    const preview = await renderSheet({ template: null, slots: ONE_STRIP_SEED, photos: await allPhotos() }, { kind: 'preview' })
    const meta = await sharp(preview).metadata()
    expect(meta).toMatchObject({ format: 'jpeg', width: PREVIEW_WIDTH, height: Math.round((PREVIEW_WIDTH * 1240) / 1844) })
  })
})
