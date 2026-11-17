// Builds assets/brand/mark-header.png from assets/brand/mark.png (DESIGN §15): the symbol trimmed to its
// artwork, centered in a square and resampled once with Lanczos to 144 px (4× the 36 px header slot, so
// it is exact at 1x and 2x DPR). The browser then only downscales a small image instead of the 1024 px
// hairline art, which is what blurred it. Run with `pnpm header-mark`.
import { resolve } from 'node:path'
import sharp from 'sharp'

const ROOT = resolve(import.meta.dirname, '..')
const SOURCE = resolve(ROOT, 'assets/brand/mark.png')
const TARGET = resolve(ROOT, 'assets/brand/mark-header.png')
const SIZE = 144
const PAD = 6

const trimmed = await sharp(SOURCE).trim().toBuffer({ resolveWithObject: true })
const side = Math.max(trimmed.info.width, trimmed.info.height)
const inner = SIZE - PAD * 2
await sharp(trimmed.data)
  .resize(inner, inner, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 }, kernel: 'lanczos3' })
  .extend({ top: PAD, bottom: PAD, left: PAD, right: PAD, background: { r: 0, g: 0, b: 0, alpha: 0 } })
  .sharpen({ sigma: 0.6 })
  .png({ compressionLevel: 9 })
  .toFile(TARGET)
console.log(`mark-header.png ${SIZE}×${SIZE} (trimmed from ${trimmed.info.width}×${trimmed.info.height}, side ${side})`)
