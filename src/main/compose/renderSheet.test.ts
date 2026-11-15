import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import sharp from 'sharp'
import { describe, expect, it } from 'vitest'
import { ONE_STRIP_SEED, TWO_STRIPS_CLIENT_BOXES, TWO_STRIPS_SEED, clipToSheet, slotBounds, type PhotoIndex, type Slot } from '@shared/layout'
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
      expect(near(at(x, lowY), BODY[slot.photo ?? 1]), `${slot.id} body`).toBe(true)
      // Full width covered: the slot's own left and right edges show the photo, not the template.
      expect(near(at(box.left + 2, lowY), GRAY), `${slot.id} left edge`).toBe(false)
      expect(near(at(box.left + box.width - 3, lowY), GRAY), `${slot.id} right edge`).toBe(false)
    }
  })

  it('crops the center of the portrait in a horizontal slot: bar only in the top part', async () => {
    const jpeg = await renderSheet({ template: await template(), slots: TWO_STRIPS_SEED, photos: await allPhotos() }, { kind: 'montage' })
    const at = await pixels(jpeg)
    const bottom1 = TWO_STRIPS_SEED[3]!
    // Cover fit: the portrait is scaled to the slot width, so the slot shows a centered band of it.
    const shown = bottom1.height / ((PHOTO.height * bottom1.width) / PHOTO.width)
    const hidden = (1 - shown) / 2
    expect(hidden).toBeGreaterThan(0)
    // The bar (top 40% of the portrait) fills only the top part of the slot.
    const barRows = bottom1.height * ((BAR_FRACTION - hidden) / shown)
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

  it('leaves a slot set to Nenhuma empty, showing the template', async () => {
    const slots = ONE_STRIP_SEED.map((slot) => (slot.id === 'photo-2' ? { ...slot, photo: null } : slot))
    const jpeg = await renderSheet({ template: await template(), slots, photos: await allPhotos() }, { kind: 'montage' })
    const at = await pixels(jpeg)
    expect(near(at(922, 1000), GRAY)).toBe(true)
    expect(near(at(322, 1000), BODY[1])).toBe(true)
  })

  it('fills the one-strip sheet with no white half', async () => {
    const jpeg = await renderSheet({ template: await template(), slots: ONE_STRIP_SEED, photos: await allPhotos() }, { kind: 'montage' })
    const at = await pixels(jpeg)
    for (const x of [322, 922, 1522]) expect(near(at(x, 1000), [255, 255, 255])).toBe(false)
  })

  it('frames one slot without moving it or the other slot of the same capture (RF09)', async () => {
    const photos = await allPhotos()
    const bottom1 = TWO_STRIPS_SEED[3]!
    // Pan to the top of the portrait: the bar now fills Baixo 1 down to its middle.
    const framings = { 'bottom-1': { zoom: 1, panX: 0, panY: -1, rotation: 0 } }
    const at = await pixels(await renderSheet({ template: await template(), slots: TWO_STRIPS_SEED, photos, framings }, { kind: 'montage' }))
    expect(near(at(bottom1.left + 250, bottom1.top + 140), BAR)).toBe(true)
    // Cima 1 uses the same capture and keeps its default framing: bar on top, body below.
    const top1 = visible(TWO_STRIPS_SEED[0]!)
    expect(near(at(top1.left + top1.width / 2, top1.top - top1.hiddenTop + top1.fullHeight * 0.8), BODY[1])).toBe(true)
  })

  it('rotates the photo inside the slot and leaves no template corner showing (RF09)', async () => {
    const bottom1 = TWO_STRIPS_SEED[3]!
    const framings = { 'bottom-1': { zoom: 1, panX: 0, panY: 0, rotation: 15 } }
    const at = await pixels(await renderSheet({ template: await template(), slots: TWO_STRIPS_SEED, photos: await allPhotos(), framings }, { kind: 'montage' }))
    // Probed just inside the seed's rounded corner (radius 30: the arc is 9 px in along the diagonal).
    for (const [x, y] of [
      [bottom1.left + 12, bottom1.top + 12],
      [bottom1.left + bottom1.width - 13, bottom1.top + 12],
      [bottom1.left + 12, bottom1.top + bottom1.height - 13],
      [bottom1.left + bottom1.width - 13, bottom1.top + bottom1.height - 13],
    ] as const) {
      expect(near(at(x, y), GRAY), `corner ${x},${y}`).toBe(false)
    }
    // Outside the slot the template is untouched.
    expect(near(at(bottom1.left + bottom1.width + 20, bottom1.top + 140), GRAY)).toBe(true)
  })

  it('renders the preview from the same composition, scaled down', async () => {
    const preview = await renderSheet({ template: null, slots: ONE_STRIP_SEED, photos: await allPhotos() }, { kind: 'preview' })
    const meta = await sharp(preview).metadata()
    expect(meta).toMatchObject({ format: 'jpeg', width: PREVIEW_WIDTH, height: Math.round((PREVIEW_WIDTH * 1240) / 1844) })
  })
})

describe('renderSheet over the client 2 tiras artwork', () => {
  const CLIENT = resolve(import.meta.dirname, '../../../e2e/fixtures/client-2tiras-1844x1240.png')
  const dark = ([r, g, b]: Rgb) => r < 60 && g < 60 && b < 60
  /** The artwork's black, or its anti-aliased gray edge: a neutral pixel that is not paper white. */
  const ink = ([r, g, b]: Rgb) => Math.abs(r - g) < 14 && Math.abs(g - b) < 14 && r < 225

  it('fills every black photo box: no black corner or edge shows, the art around stays', async () => {
    const jpeg = await renderSheet({ template: await readFile(CLIENT), slots: TWO_STRIPS_SEED, photos: await allPhotos() }, { kind: 'montage' })
    const { data, info } = await sharp(jpeg).raw().toBuffer({ resolveWithObject: true })
    const at = (x: number, y: number): Rgb => {
      const i = (y * info.width + x) * info.channels
      return [data[i]!, data[i + 1]!, data[i + 2]!]
    }
    for (const box of TWO_STRIPS_CLIENT_BOXES) {
      // Not one dark pixel left anywhere inside the box, rounded corners included.
      let black = 0
      for (let y = box.top; y < box.top + box.height; y++) for (let x = box.left; x < box.left + box.width; x++) if (dark(at(x, y))) black++
      expect(black, `black pixels in the box at ${box.left},${box.top}`).toBe(0)
      // No gray hairline on any straight edge: the columns and rows just inside and outside each edge.
      const midX = box.left + Math.floor(box.width / 2)
      const midY = box.top + Math.floor(box.height / 2)
      for (const [x, y] of [
        [box.left - 1, midY],
        [box.left, midY],
        [box.left + box.width - 1, midY],
        [box.left + box.width, midY],
        [midX, box.top - 1],
        [midX, box.top],
        [midX, box.top + box.height - 1],
        [midX, box.top + box.height],
      ] as const) {
        expect(ink(at(x, y)), `edge ${x},${y} = ${at(x, y).join(',')}`).toBe(false)
      }
      // The photo is clipped to the rounded corner: the very corner pixel is the white paper, not photo.
      for (const [x, y] of [
        [box.left + 1, box.top + 1],
        [box.left + box.width - 2, box.top + 1],
        [box.left + 1, box.top + box.height - 2],
        [box.left + box.width - 2, box.top + box.height - 2],
      ] as const) {
        expect(near(at(x, y), [255, 255, 255]), `corner ${x},${y}`).toBe(true)
      }
      // Just outside the box the artwork is untouched (white paper there).
      expect(near(at(box.left + box.width / 2, box.top + box.height + 6), [255, 255, 255])).toBe(true)
    }
  })
})
