// Dev-only check (not shipped): renders a 2 tiras montage through renderSheet over a template with
// black rounded boxes, with the slots dragged and rotated off the boxes like the operator did, and
// counts the defects: black left inside a box, or photo drawn outside a box.
// Usage: node scripts/dev/box-clip.mjs <template.png> <out.png> [shifted]
// `shifted` ignores the template's art and draws black boxes away from the seed positions (other
// places, sizes and corner radius), to check that the montage follows the template's own boxes.
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
const photo = await sharp(
  Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="720" height="1280"><defs><linearGradient id="g" x2="1" y2="1"><stop offset="0" stop-color="#ff6040"/><stop offset="1" stop-color="#40c0ff"/></linearGradient></defs><rect width="720" height="1280" fill="url(#g)"/><circle cx="360" cy="500" r="200" fill="#ffd060"/></svg>`),
).jpeg({ quality: 95 }).toBuffer()

// Slots off their boxes, like the editor screenshot: Cima 1 turned and pushed down-left, Cima 2
// and Cima 3 pushed right and down, Baixo 1 and 2 smaller and pushed up and right.
const slots = [
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
const ch = sheet.info.channels
for (let i = 0; i < W * H; i++) {
  const [r, g, b] = [sheet.data[i * ch], sheet.data[i * ch + 1], sheet.data[i * ch + 2]]
  if (core[i] && Math.max(r, g, b) < 60) blackInside++
  if (!near[i]) {
    const diff = Math.abs(r - tpl[i * 3]) + Math.abs(g - tpl[i * 3 + 1]) + Math.abs(b - tpl[i * 3 + 2])
    if (diff > 60) photoOutside++
  }
}
const pass = blackInside === 0 && photoOutside === 0
console.log(JSON.stringify({ out: outPath, detectedBoxes: boxes ? boxes.length : 0, blackInside, photoOutside, verdict: pass ? 'PASS' : 'FAIL' }))
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
