import sharp from 'sharp'
import { describe, expect, it } from 'vitest'
import { CLIENT_BOX_RADIUS, TWO_STRIPS_CLIENT_BOXES, type Framing, type Slot } from '@shared/layout'
import { detectTemplateBoxes } from './detectBoxes'
import { composeSheet } from './renderSheet'

const W = 1844
const H = 1240
const RX = 33

/** The client's 2 tiras artwork reduced to its essence: black rounded photo boxes on white. */
async function boxTemplate(): Promise<Buffer> {
  const rects = TWO_STRIPS_CLIENT_BOXES.map((b) => `<rect x="${b.left}" y="${b.top}" width="${b.width}" height="${b.height}" rx="${RX}" fill="#000"/>`).join('')
  return sharp({ create: { width: W, height: H, channels: 3, background: '#fff' } })
    .composite([{ input: Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">${rects}</svg>`) }])
    .png()
    .toBuffer()
}

/**
 * A bright portrait capture that is smooth everywhere (diagonal gradient plus soft reflected rings):
 * any sharp jump between neighbouring pixels inside a box is a seam between two copies, and no pixel
 * is dark, so a dark pixel in a box is the template showing through a gap.
 */
async function smoothPhoto(): Promise<Buffer> {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="720" height="1280"><defs><linearGradient id="g" x2="1" y2="1"><stop offset="0" stop-color="#ff6040"/><stop offset="1" stop-color="#40c0ff"/></linearGradient><radialGradient id="s" gradientUnits="userSpaceOnUse" cx="360" cy="500" r="60" spreadMethod="reflect"><stop offset="0" stop-color="#ffe070"/><stop offset="1" stop-color="#6040c0"/></radialGradient></defs><rect width="720" height="1280" fill="url(#g)"/><rect width="720" height="1280" fill="url(#s)" opacity="0.55"/></svg>`
  return sharp(Buffer.from(svg)).jpeg({ quality: 95 }).toBuffer()
}

/** A card given by its visible bounds on the sheet, turned by `angle`. */
function card(id: string, photo: 1 | 2 | 3, b: { left: number; top: number; width: number; height: number }, angle: number): Slot {
  const quarter = angle % 180 !== 0
  const width = quarter ? b.height : b.width
  const height = quarter ? b.width : b.height
  return { id, photo, left: b.left + b.width / 2 - width / 2, top: b.top + b.height / 2 - height / 2, width, height, angle, radius: CLIENT_BOX_RADIUS }
}

/**
 * The cards of the v0.2.3 seam report (/tmp/lines-bug/6.png): Cima 1 wider and pushed left over
 * Cima 2, Cima 2 and Cima 3 wider and starting inside their box, Cima 3 taller across the cut line,
 * Baixo 2 smaller, pushed and turned off a quarter turn.
 */
const CARDS: Slot[] = [
  card('top-1', 1, { left: 60, top: -34, width: 490, height: 694 }, 270),
  card('top-2', 2, { left: 548, top: -12, width: 412, height: 610 }, 270),
  card('top-3', 3, { left: 958, top: 20, width: 436, height: 640 }, 280),
  { id: 'bottom-1', photo: 1, left: 62, top: 733, width: 602, height: 402, angle: 0, radius: CLIENT_BOX_RADIUS },
  { id: 'bottom-2', photo: 2, left: 760, top: 650, width: 500, height: 330, angle: 7, radius: CLIENT_BOX_RADIUS },
]

/** Signed distance to the rounded box (negative inside). */
function boxDistance(x: number, y: number, b: { left: number; top: number; width: number; height: number }): number {
  const hx = b.width / 2 - RX
  const hy = b.height / 2 - RX
  const dx = Math.abs(x + 0.5 - (b.left + b.width / 2)) - hx
  const dy = Math.abs(y + 0.5 - (b.top + b.height / 2)) - hy
  return Math.hypot(Math.max(dx, 0), Math.max(dy, 0)) + Math.min(Math.max(dx, dy), 0) - RX
}

async function defects(framings?: Record<string, Framing>) {
  const template = await boxTemplate()
  const photo = await smoothPhoto()
  const boxes = await detectTemplateBoxes(template, 'two-strips')
  expect(boxes).toHaveLength(5)
  const sheet = await composeSheet({ mode: 'two-strips', template, slots: CARDS, photos: { 1: photo, 2: photo, 3: photo }, framings, boxes })
  const tpl = await sharp(template).removeAlpha().raw().toBuffer()
  const { data, info } = sheet
  const ch = info.channels
  const px = (x: number, y: number) => (y * W + x) * ch
  const jump = (a: number, b: number) => Math.abs(data[a]! - data[b]!) + Math.abs(data[a + 1]! - data[b + 1]!) + Math.abs(data[a + 2]! - data[b + 2]!)
  const distance = (x: number, y: number) => Math.min(...TWO_STRIPS_CLIENT_BOXES.map((b) => boxDistance(x, y, b)))
  let gaps = 0
  let seams = 0
  let overflow = 0
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const d = distance(x, y)
      const at = px(x, y)
      if (d < -3) {
        if (Math.max(data[at]!, data[at + 1]!, data[at + 2]!) < 60) gaps++
        if (x + 1 < W && distance(x + 1, y) < -3 && jump(at, px(x + 1, y)) > 30) seams++
        if (y + 1 < H && distance(x, y + 1) < -3 && jump(at, px(x, y + 1)) > 30) seams++
      } else if (d > 3) {
        const t = (y * W + x) * 3
        if (Math.abs(data[at]! - tpl[t]!) + Math.abs(data[at + 1]! - tpl[t + 1]!) + Math.abs(data[at + 2]! - tpl[t + 2]!) > 60) overflow++
      }
    }
  }
  return { gaps, seams, overflow }
}

describe('renderSheet draws exactly one photo per box (DESIGN §6)', () => {
  it('leaves no seam, gap or overflow with the cards of the seam report', async () => {
    expect(await defects()).toEqual({ gaps: 0, seams: 0, overflow: 0 })
  }, 30_000)

  it('keeps every box covered when the round is zoomed, panned and turned to the limits', async () => {
    const framings: Record<string, Framing> = {
      'top-1': { zoom: 1, panX: 1, panY: -1, rotation: 25 },
      'top-3': { zoom: 3, panX: -1, panY: 1, rotation: -40 },
      'bottom-2': { zoom: 1.4, panX: 1, panY: 1, rotation: 180 },
    }
    expect(await defects(framings)).toEqual({ gaps: 0, seams: 0, overflow: 0 })
  }, 30_000)
})
