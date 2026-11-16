// Dev-only check (not shipped): renders a 2 tiras montage through renderSheet over a template with
// black rounded boxes, with the slots dragged and rotated off the boxes like the operator did, and
// counts the defects: black left inside a box, or photo drawn outside a box.
// Usage: node scripts/dev/box-clip.mjs <template.png> <out.png> [shifted|cards]
// `shifted` ignores the template's art and draws black boxes away from the seed positions (other
// places, sizes and corner radius), to check that the montage follows the template's own boxes.
// `cards` uses the card layout of the v0.2.3 seam report (Cima 1 wider and pushed left over Cima 2,
// Cima 2 wider, Cima 3 taller across the cut line) and also counts seams: sharp jumps between
// neighbouring pixels inside a box, which a smooth test photo never has.
import { existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { createJiti } from 'jiti'
import sharp from 'sharp'

const root = resolve(import.meta.dirname, '../..')
const jiti = createJiti(import.meta.url, { alias: { '@shared': resolve(root, 'src/shared') } })
const { composeSheet } = await jiti.import(resolve(root, 'src/main/compose/renderSheet.ts'))
const { TWO_STRIPS_CLIENT_BOXES, CLIENT_BOX_RADIUS } = await jiti.import(resolve(root, 'src/shared/layout/index.ts'))

// Box detection, when this checkout has it (the app passes its result as the fixed boxes).
const detectPath = resolve(root, 'src/main/compose/detectBoxes.ts')
const detect = existsSync(detectPath) ? (await jiti.import(detectPath)).detectTemplateBoxes : async () => null

const [templatePath, outPath, variant] = process.argv.slice(2)
if (!templatePath || !outPath) throw new Error('usage: box-clip.mjs <template.png> <out.png>')
const W = 1844
const H = 1240

// The template; if it has no dark boxes, draw black rounded boxes at the seed positions on white.
let template = await sharp(templatePath).resize(W, H, { fit: 'fill' }).flatten({ background: '#fff' }).png().toBuffer()
const dark = await darkMask(template)
const SHIFTED_BOXES = [
  { left: 90, top: 80, width: 380, height: 500 },
  { left: 520, top: 80, width: 380, height: 500 },
  { left: 950, top: 80, width: 380, height: 500 },
  { left: 90, top: 690, width: 620, height: 470 },
  { left: 760, top: 690, width: 570, height: 470 },
]
if (variant === 'shifted' || dark.count < 10000) {
  const drawn = variant === 'shifted' ? SHIFTED_BOXES : TWO_STRIPS_CLIENT_BOXES
  const rx = variant === 'shifted' ? 60 : 33
  const rects = drawn.map((b) => `<rect x="${b.left}" y="${b.top}" width="${b.width}" height="${b.height}" rx="${rx}" fill="#000"/>`).join('')
  template = await sharp({ create: { width: W, height: H, channels: 3, background: '#fff' } })
    .composite([{ input: Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">${rects}</svg>`) }])
    .png()
    .toBuffer()
}

// A bright portrait capture with no dark pixel: any dark pixel in a box is the template's black.
// Smooth everywhere (soft rings, no hard edge), so any sharp jump in a box is a seam; the rings make
// a misaligned second copy easy to see.
const photo = await sharp(
  Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="720" height="1280"><defs><linearGradient id="g" x2="1" y2="1"><stop offset="0" stop-color="#ff6040"/><stop offset="1" stop-color="#40c0ff"/></linearGradient><radialGradient id="s" gradientUnits="userSpaceOnUse" cx="360" cy="500" r="60" spreadMethod="reflect"><stop offset="0" stop-color="#ffe070"/><stop offset="1" stop-color="#6040c0"/></radialGradient></defs><rect width="720" height="1280" fill="url(#g)"/><rect width="720" height="1280" fill="url(#s)" opacity="0.55"/></svg>`),
).jpeg({ quality: 95 }).toBuffer()

// Slots off their boxes, like the editor screenshot: Cima 1 turned and pushed down-left, Cima 2
// and Cima 3 pushed right and down, Baixo 1 and 2 smaller and pushed up and right.
// Cards of the report screenshots, as visible bounds on the sheet (all three top cards turned 270°):
// Cima 1 sticks out left and over Cima 2 (6.png); Cima 2 and Cima 3 are wider and start ~15 px inside
// their box's left edge, where 1.png and 5.png show the seam; Cima 3 is taller, across the cut line.
const fromBounds = (id, photo, b, angle) => {
  const quarter = angle % 180 !== 0
  const width = quarter ? b.height : b.width
  const height = quarter ? b.width : b.height
  return { id, photo, left: b.left + b.width / 2 - width / 2, top: b.top + b.height / 2 - height / 2, width, height, angle, radius: CLIENT_BOX_RADIUS }
}
const CARDS = [
  fromBounds('top-1', 1, { left: 60, top: -34, width: 490, height: 694 }, 270),
  fromBounds('top-2', 2, { left: 548, top: -12, width: 412, height: 610 }, 270),
  fromBounds('top-3', 3, { left: 958, top: 20, width: 436, height: 640 }, 270),
  { id: 'bottom-1', photo: 1, left: 62, top: 733, width: 602, height: 402, angle: 0, radius: CLIENT_BOX_RADIUS },
  { id: 'bottom-2', photo: 2, left: 708, top: 733, width: 602, height: 402, angle: 0, radius: CLIENT_BOX_RADIUS },
]
const slots = variant === 'cards' ? CARDS : [
  { id: 'top-1', photo: 1, left: 20, top: 220, width: 532, height: 358, angle: 280, radius: CLIENT_BOX_RADIUS },
  { id: 'top-2', photo: 2, left: 480, top: 170, width: 532, height: 358, angle: 270, radius: CLIENT_BOX_RADIUS },
  { id: 'top-3', photo: 3, left: 1030, top: 120, width: 532, height: 358, angle: 270, radius: CLIENT_BOX_RADIUS },
  { id: 'bottom-1', photo: 1, left: 150, top: 600, width: 560, height: 380, angle: 0, radius: CLIENT_BOX_RADIUS },
  { id: 'bottom-2', photo: 2, left: 760, top: 600, width: 560, height: 380, angle: 0, radius: CLIENT_BOX_RADIUS },
]

const boxes = await detect(template, 'two-strips')
const sheet = await composeSheet({ mode: 'two-strips', template, slots, photos: { 1: photo, 2: photo, 3: photo }, boxes })
await sharp(sheet.data, { raw: { width: sheet.info.width, height: sheet.info.height, channels: sheet.info.channels } }).png().toFile(outPath)

// Pixel check (on the template the montage used, so recompute its dark mask). Inside = the template's dark pixels shrunk by 3 px; outside = farther than 3 px from any.
const tpl = await sharp(template).removeAlpha().raw().toBuffer()
const drawnDark = await darkMask(template)
const near = dilate(drawnDark.mask, 3)
const core = erode(drawnDark.mask, 3)
let blackInside = 0
let photoOutside = 0
let seams = 0
const ch = sheet.info.channels
const jump = (i, j) => Math.abs(sheet.data[i * ch] - sheet.data[j * ch]) + Math.abs(sheet.data[i * ch + 1] - sheet.data[j * ch + 1]) + Math.abs(sheet.data[i * ch + 2] - sheet.data[j * ch + 2])
for (let i = 0; i < W * H; i++) {
  const [r, g, b] = [sheet.data[i * ch], sheet.data[i * ch + 1], sheet.data[i * ch + 2]]
  if (core[i] && Math.max(r, g, b) < 60) blackInside++
  if (core[i] && ((i % W < W - 1 && core[i + 1] && jump(i, i + 1) > 30) || (i + W < W * H && core[i + W] && jump(i, i + W) > 30))) seams++
  if (!near[i]) {
    const diff = Math.abs(r - tpl[i * 3]) + Math.abs(g - tpl[i * 3 + 1]) + Math.abs(b - tpl[i * 3 + 2])
    if (diff > 60) photoOutside++
  }
}
const pass = blackInside === 0 && photoOutside === 0 && seams === 0
console.log(JSON.stringify({ out: outPath, detectedBoxes: boxes ? boxes.length : 0, blackInside, photoOutside, seams, verdict: pass ? 'PASS' : 'FAIL' }))
process.exitCode = pass ? 0 : 1

async function darkMask(png) {
  const { data } = await sharp(png).flatten({ background: '#fff' }).greyscale().raw().toBuffer({ resolveWithObject: true })
  const mask = new Uint8Array(W * H)
  let count = 0
  for (let i = 0; i < W * H; i++) if (data[i] < 60) { mask[i] = 1; count++ }
  return { mask, count }
}

function morph(mask, radius, grow) {
  // Separable square min/max filter.
  const pass = (src, dx, dy) => {
    const out = new Uint8Array(W * H)
    for (let y = 0; y < H; y++)
      for (let x = 0; x < W; x++) {
        let v = grow ? 0 : 1
        for (let k = -radius; k <= radius; k++) {
          const xx = x + k * dx
          const yy = y + k * dy
          const s = xx < 0 || yy < 0 || xx >= W || yy >= H ? 0 : src[yy * W + xx]
          if (grow ? s : !s) { v = grow ? 1 : 0; break }
        }
        out[y * W + x] = v
      }
    return out
  }
  return pass(pass(mask, 1, 0), 0, 1)
}
function dilate(mask, r) { return morph(mask, r, true) }
function erode(mask, r) { return morph(mask, r, false) }
