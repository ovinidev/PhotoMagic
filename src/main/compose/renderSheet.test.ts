import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import sharp from 'sharp'
import { describe, expect, it } from 'vitest'
import { ONE_STRIP_SEED, TWO_STRIPS_CLIENT_BOXES, TWO_STRIPS_SEED, clipToSheet, guideBoxes, type GuideBox, photoPlacement, planSlot, slotBounds, slotCenter, type Framing, type PhotoIndex, type Slot } from '@shared/layout'
import { PREVIEW_WIDTH, composeSheet, renderSheet } from './renderSheet'

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


/**
 * 2 tiras with the bottom cards at Angle 0, as before 2026-11-28. The seed's bottom cards stand at
 * Angle 270 now, but the photo is planned on the fixed box and the person stays upright, so the sheet
 * is the same (checked below); the geometry these tests probe is the lying card's.
 */
const LANDSCAPE_BOTTOM: Slot[] = TWO_STRIPS_SEED.map((slot) => (slot.id.startsWith('bottom-') ? { ...slot, angle: 0 } : slot))

describe('renderSheet (RF08, RF12)', () => {
  it('prints the same sheet with the bottom cards standing (Angle 270) as lying (Angle 0)', async () => {
    const tpl = await template()
    const photos = await allPhotos()
    const standing = await sharp(await renderSheet({ mode: 'two-strips', template: tpl, slots: TWO_STRIPS_SEED, photos }, { kind: 'montage' })).raw().toBuffer()
    const lying = await sharp(await renderSheet({ mode: 'two-strips', template: tpl, slots: LANDSCAPE_BOTTOM, photos }, { kind: 'montage' })).raw().toBuffer()
    // The same crop, up to a pixel of rounding where the photo's bar meets its body: well under 1 % of
    // the two bottom boxes differs, and nothing outside them.
    const [, , , b1, b2] = guideBoxes('two-strips')
    const inBottom = (x: number, y: number) => [b1!, b2!].some(({ rect }) => x >= rect.left && x < rect.left + rect.width && y >= rect.top && y < rect.top + rect.height)
    let different = 0
    let outside = 0
    for (let pixel = 0; pixel < standing.length / 3; pixel += 1) {
      if ([0, 1, 2].every((c) => Math.abs(standing[pixel * 3 + c]! - lying[pixel * 3 + c]!) <= 24)) continue
      different += 1
      if (!inBottom(pixel % 1844, Math.floor(pixel / 1844))) outside += 1
    }
    expect(outside).toBe(0)
    expect(different).toBeLessThan(0.01 * 2 * 602 * 402)
  })

  it('writes a 1844×1240 JPEG at 300 DPI', async () => {
    const jpeg = await renderSheet({ mode: 'two-strips', template: await template(), slots: LANDSCAPE_BOTTOM, photos: await allPhotos() }, { kind: 'montage' })
    const meta = await sharp(jpeg).metadata()
    expect(meta).toMatchObject({ format: 'jpeg', width: 1844, height: 1240, density: 300 })
  })

  it.each([
    ['two-strips', LANDSCAPE_BOTTOM],
    ['one-strip', ONE_STRIP_SEED],
  ] as const)('puts each photo upright in its slots, bar on top, in %s', async (mode, slots) => {
    const jpeg = await renderSheet({ mode, template: await template(), slots, photos: await allPhotos() }, { kind: 'montage' })
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
    const jpeg = await renderSheet({ mode: 'two-strips', template: await template(), slots: LANDSCAPE_BOTTOM, photos: await allPhotos() }, { kind: 'montage' })
    const at = await pixels(jpeg)
    const bottom1 = LANDSCAPE_BOTTOM[3]!
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
    const jpeg = await renderSheet({ mode: 'two-strips', template: await template(), slots: LANDSCAPE_BOTTOM, photos: { 1: await capture(1) } }, { kind: 'montage' })
    const at = await pixels(jpeg)
    const top3 = visible(LANDSCAPE_BOTTOM[2]!)
    expect(near(at(top3.left + top3.width / 2, top3.top + top3.height / 2), GRAY)).toBe(true)
    const bottom1 = LANDSCAPE_BOTTOM[3]!
    expect(near(at(bottom1.left + 250, bottom1.top + 250), BODY[1])).toBe(true)
  })

  it('leaves a slot set to Nenhuma empty, showing the template', async () => {
    const slots = ONE_STRIP_SEED.map((slot) => (slot.id === 'photo-2' ? { ...slot, photo: null } : slot))
    const jpeg = await renderSheet({ mode: 'one-strip', template: await template(), slots, photos: await allPhotos() }, { kind: 'montage' })
    const at = await pixels(jpeg)
    expect(near(at(922, 1000), GRAY)).toBe(true)
    expect(near(at(322, 1000), BODY[1])).toBe(true)
  })

  it('fills the one-strip sheet with no white half', async () => {
    const jpeg = await renderSheet({ mode: 'one-strip', template: await template(), slots: ONE_STRIP_SEED, photos: await allPhotos() }, { kind: 'montage' })
    const at = await pixels(jpeg)
    for (const x of [322, 922, 1522]) expect(near(at(x, 1000), [255, 255, 255])).toBe(false)
  })

  it('frames one slot without moving it or the other slot of the same capture (RF09)', async () => {
    const photos = await allPhotos()
    const bottom1 = LANDSCAPE_BOTTOM[3]!
    // Pan to the top of the portrait: the bar now fills Baixo 1 down to its middle.
    const framings = { 'bottom-1': { zoom: 1, panX: 0, panY: -1, rotation: 0 } }
    const at = await pixels(await renderSheet({ mode: 'two-strips', template: await template(), slots: LANDSCAPE_BOTTOM, photos, framings }, { kind: 'montage' }))
    expect(near(at(bottom1.left + 250, bottom1.top + 140), BAR)).toBe(true)
    // Cima 1 uses the same capture and keeps its default framing: bar on top, body below.
    const top1 = visible(LANDSCAPE_BOTTOM[0]!)
    expect(near(at(top1.left + top1.width / 2, top1.top - top1.hiddenTop + top1.fullHeight * 0.8), BODY[1])).toBe(true)
  })

  it('rotates the photo inside the slot and leaves no template corner showing (RF09)', async () => {
    const bottom1 = LANDSCAPE_BOTTOM[3]!
    const framings = { 'bottom-1': { zoom: 1, panX: 0, panY: 0, rotation: 15 } }
    const at = await pixels(await renderSheet({ mode: 'two-strips', template: await template(), slots: LANDSCAPE_BOTTOM, photos: await allPhotos(), framings }, { kind: 'montage' }))
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
    const preview = await renderSheet({ mode: 'one-strip', template: null, slots: ONE_STRIP_SEED, photos: await allPhotos() }, { kind: 'preview' })
    const meta = await sharp(preview).metadata()
    expect(meta).toMatchObject({ format: 'jpeg', width: PREVIEW_WIDTH, height: Math.round((PREVIEW_WIDTH * 1240) / 1844) })
  })

  it('composes the preview at its own size and still matches the montage scaled down, framing included', async () => {
    const framings: Record<string, Framing> = {
      'top-1': { zoom: 1.6, panX: 0.4, panY: -0.3, rotation: 12 },
      'bottom-2': { zoom: 2, panX: -0.5, panY: 0.5, rotation: -30 },
    }
    const input = { mode: 'two-strips' as const, template: await template(), slots: LANDSCAPE_BOTTOM, photos: await allPhotos(), framings }
    const full = await composeSheet(input)
    const half = await composeSheet(input, PREVIEW_WIDTH / 1844)
    expect(half.info).toMatchObject({ width: 922, height: 620 })
    const scaled = await sharp(full.data, { raw: { width: full.info.width, height: full.info.height, channels: 3 } }).resize(922, 620, { fit: 'fill' }).raw().toBuffer()
    // Mean channel difference: only edge anti-aliasing differs, never a misplaced or missing photo.
    let diff = 0
    for (let i = 0; i < scaled.length; i++) diff += Math.abs(scaled[i]! - half.data[i]!)
    expect(diff / scaled.length).toBeLessThan(3)
  })
})

describe('renderSheet over the client 2 tiras artwork', () => {
  const CLIENT = resolve(import.meta.dirname, '../../../e2e/fixtures/client-2tiras-1844x1240.png')
  const dark = ([r, g, b]: Rgb) => r < 60 && g < 60 && b < 60
  /** The artwork's black, or its anti-aliased gray edge: a neutral pixel that is not paper white. */
  const ink = ([r, g, b]: Rgb) => Math.abs(r - g) < 14 && Math.abs(g - b) < 14 && r < 225

  it('fills every black photo box: no black corner or edge shows, the art around stays', async () => {
    const jpeg = await renderSheet({ mode: 'two-strips', template: await readFile(CLIENT), slots: LANDSCAPE_BOTTOM, photos: await allPhotos() }, { kind: 'montage' })
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

/**
 * The pixel sweeps below compare whole 1844×1240 sheets. Under coverage, with the rest of the suite
 * running in parallel (the pre-push hook), one test can pass the default 5 s on a laptop.
 */
const PIXEL_SWEEP = { timeout: 30_000 }

describe('renderSheet keeps each photo inside its slot (RF09, DESIGN §8)', PIXEL_SWEEP, () => {
  const GRADIENT = { width: 360, height: 640 }

  /** A portrait whose color says where each pixel came from: red grows left to right, green top to bottom. */
  async function gradient(): Promise<Buffer> {
    const data = Buffer.alloc(GRADIENT.width * GRADIENT.height * 3)
    for (let v = 0; v < GRADIENT.height; v += 1) {
      for (let u = 0; u < GRADIENT.width; u += 1) {
        const at = (v * GRADIENT.width + u) * 3
        data[at] = Math.round((255 * u) / (GRADIENT.width - 1))
        data[at + 1] = Math.round((255 * v) / (GRADIENT.height - 1))
        data[at + 2] = 128
      }
    }
    return sharp(data, { raw: { ...GRADIENT, channels: 3 } }).png().toBuffer()
  }

  /** A busy template, so any photo pixel drawn over it would change it. */
  async function stripes(): Promise<Buffer> {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1844" height="1240"><rect width="1844" height="1240" fill="#3060a0"/>${Array.from({ length: 46 }, (_, i) => `<rect x="${i * 40}" width="20" height="1240" fill="#f0d020"/>`).join('')}</svg>`
    return sharp(Buffer.from(svg)).png().toBuffer()
  }

  /** The point (x, y) of the sheet in the slot's own box axes, from the box center. */
  function inBox(slot: Slot, x: number, y: number) {
    const center = slotCenter(slot)
    const radians = (-slot.angle * Math.PI) / 180
    const dx = x - center.x
    const dy = y - center.y
    return { x: dx * Math.cos(radians) - dy * Math.sin(radians), y: dx * Math.sin(radians) + dy * Math.cos(radians) }
  }

  /** True when the sheet point lies within `margin` px of the slot's rounded box. */
  function nearSlot(slot: Slot, x: number, y: number, margin: number) {
    const point = inBox(slot, x, y)
    const r = slot.radius ?? 0
    const qx = Math.max(0, Math.abs(point.x) - (slot.width / 2 - r))
    const qy = Math.max(0, Math.abs(point.y) - (slot.height / 2 - r))
    return Math.hypot(qx, qy) - r <= margin
  }

  const moved: Record<string, Framing> = {
    'top-1': { zoom: 2.5, panX: 1, panY: -1, rotation: 0 },
    'top-2': { zoom: 1.8, panX: -0.7, panY: 0.4, rotation: 23 },
    'bottom-1': { zoom: 3, panX: -1, panY: 1, rotation: -140 },
    'bottom-2': { zoom: 1.4, panX: 0.5, panY: -0.5, rotation: 90 },
  }

  it('leaves every pixel outside the slots equal to the template when photos are moved, zoomed and turned', async () => {
    const tpl = await stripes()
    const photo = await gradient()
    const empty = await sharp(await renderSheet({ mode: 'two-strips', template: tpl, slots: LANDSCAPE_BOTTOM, photos: {} }, { kind: 'montage' })).raw().toBuffer()
    const framed = await sharp(
      await renderSheet({ mode: 'two-strips', template: tpl, slots: LANDSCAPE_BOTTOM, photos: { 1: photo, 2: photo, 3: photo }, framings: moved }, { kind: 'montage' }),
    )
      .raw()
      .toBuffer()
    let checked = 0
    let changed = 0
    for (let y = 0; y < 1240; y += 1) {
      for (let x = 0; x < 1844; x += 1) {
        // JPEG blocks are 8 px: pixels sharing a block with the photo edge may move a little.
        if (LANDSCAPE_BOTTOM.some((slot) => nearSlot(slot, x, y, 10))) continue
        const at = (y * 1844 + x) * 3
        checked += 1
        // A photo pixel over the stripes would be off by far more; a few levels are JPEG ringing.
        if ([0, 1, 2].some((c) => Math.abs(empty[at + c]! - framed[at + c]!) > 12)) changed += 1
      }
    }
    expect(checked).toBeGreaterThan(1_000_000)
    expect(changed).toBe(0)
  })

  it('draws each photo exactly where the shared placement (the laptop CSS transform) puts it', async () => {
    const photo = await gradient()
    const at = await pixels(await renderSheet({ mode: 'two-strips', template: await stripes(), slots: LANDSCAPE_BOTTOM, photos: { 1: photo, 2: photo, 3: photo }, framings: moved }, { kind: 'montage' }))
    for (const slot of LANDSCAPE_BOTTOM) {
      const placement = photoPlacement(planSlot(slot, GRADIENT, moved[slot.id]))
      const radians = (-placement.rotation * Math.PI) / 180
      const center = slotCenter(slot)
      for (const [fx, fy] of [[0, 0], [-0.3, -0.3], [0.3, -0.25], [0.25, 0.3], [-0.3, 0.2]] as const) {
        // A point of the box (fractions from its center), on the sheet…
        const bx = fx * slot.width
        const by = fy * slot.height
        const turn = (slot.angle * Math.PI) / 180
        const x = center.x + bx * Math.cos(turn) - by * Math.sin(turn)
        const y = center.y + bx * Math.sin(turn) + by * Math.cos(turn)
        if (x < 0 || y < 0 || x >= 1844 || y >= 1240) continue
        // …and the photo pixel the placement puts there.
        const dx = bx - placement.x
        const dy = by - placement.y
        const u = ((dx * Math.cos(radians) - dy * Math.sin(radians)) / placement.width + 0.5) * GRADIENT.width
        const v = ((dx * Math.sin(radians) + dy * Math.cos(radians)) / placement.height + 0.5) * GRADIENT.height
        const [r, g] = at(x, y)
        expect(Math.abs(r - (255 * u) / (GRADIENT.width - 1)), `${slot.id} red at ${fx},${fy}`).toBeLessThanOrEqual(8)
        expect(Math.abs(g - (255 * v) / (GRADIENT.height - 1)), `${slot.id} green at ${fx},${fy}`).toBeLessThanOrEqual(8)
      }
    }
  })
})

describe('renderSheet clips every photo to its fixed gray box (DESIGN §6)', PIXEL_SWEEP, () => {
  /** A portrait gradient whose blue is always 128: no template pixel below has that blue. */
  async function gradient(): Promise<Buffer> {
    const { width, height } = PHOTO
    const data = Buffer.alloc(width * height * 3)
    for (let v = 0; v < height; v += 1) {
      for (let u = 0; u < width; u += 1) {
        const at = (v * width + u) * 3
        data[at] = Math.round((255 * u) / (width - 1))
        data[at + 1] = Math.round((255 * v) / (height - 1))
        data[at + 2] = 128
      }
    }
    return sharp(data, { raw: { width, height, channels: 3 } }).png().toBuffer()
  }

  async function stripes(): Promise<Buffer> {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1844" height="1240"><rect width="1844" height="1240" fill="#3060a0"/>${Array.from({ length: 62 }, (_, i) => `<rect y="${i * 20}" width="1844" height="10" fill="#f0d020"/>`).join('')}</svg>`
    return sharp(Buffer.from(svg)).png().toBuffer()
  }

  /** Signed distance (px) from the sheet point to the rounded gray box: negative inside. */
  function distance(box: GuideBox, x: number, y: number) {
    const { left, top, width, height } = box.rect
    const px = Math.abs(x + 0.5 - (left + width / 2))
    const py = Math.abs(y + 0.5 - (top + height / 2))
    const r = box.radius
    const qx = px - (width / 2 - r)
    const qy = py - (height / 2 - r)
    return Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) + Math.min(Math.max(qx, qy), 0) - r
  }

  // The owner's case: cards enlarged, moved off their boxes, shrunk and turned in the editor.
  const edited: Slot[] = LANDSCAPE_BOTTOM.map((slot) => {
    switch (slot.id) {
      case 'top-1':
        return { ...slot, left: slot.left - 80, top: slot.top - 60, width: slot.width + 300, height: slot.height + 260 }
      case 'top-2':
        return { ...slot, left: slot.left + 300, top: slot.top + 120, angle: 280 }
      case 'top-3':
        return { ...slot, left: slot.left + 150, top: slot.top + 150, width: 200, height: 150 }
      case 'bottom-1':
        return { ...slot, left: 20, top: 500, width: 900, height: 700 }
      default:
        return { ...slot, angle: 37 }
    }
  })

  it.each([
    ['the seed slots', LANDSCAPE_BOTTOM],
    ['enlarged, moved, shrunk and turned slots', edited],
  ] as const)('with %s, leaves every pixel outside the boxes equal to the template and covers each box', async (_name, slots) => {
    const tpl = await stripes()
    const photo = await gradient()
    const framings = { 'top-1': { zoom: 2, panX: 1, panY: -1, rotation: 20 } }
    const empty = (await composeSheet({ mode: 'two-strips', template: tpl, slots, photos: {} })).data
    const sheet = await composeSheet({ mode: 'two-strips', template: tpl, slots, photos: { 1: photo, 2: photo, 3: photo }, framings })
    const boxes = guideBoxes('two-strips')
    let outside = 0
    let inside = 0
    const leaks: string[] = []
    const holes: string[] = []
    for (let y = 0; y < 1240; y += 1) {
      for (let x = 0; x < 1844; x += 1) {
        const d = Math.min(...boxes.map((box) => distance(box, x, y)))
        const at = (y * 1844 + x) * sheet.info.channels
        if (d > 1) {
          outside += 1
          if ([0, 1, 2].some((c) => sheet.data[at + c] !== empty[at + c]) && leaks.length < 5) leaks.push(`${x},${y}`)
        } else if (d < -1.5) {
          inside += 1
          if (Math.abs(sheet.data[at + 2]! - 128) > 4 && holes.length < 5) holes.push(`${x},${y}`)
        }
      }
    }
    expect(outside).toBeGreaterThan(900_000)
    expect(inside).toBeGreaterThan(900_000)
    expect(leaks).toEqual([])
    expect(holes).toEqual([])
  })
})
