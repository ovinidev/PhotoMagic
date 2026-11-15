// Builds assets/brand/icon.ico from assets/brand/icon.png (PRD RNF12, DESIGN §11, §15): the symbol
// on its light tile at 16, 32, 48 and 256 px, each entry a PNG. Run with `pnpm icon` after the
// client's SVG replaces the raster symbol. The full logo never goes into the icon.
import { readFile, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import sharp from 'sharp'

const ROOT = resolve(import.meta.dirname, '..')
const SOURCE = resolve(ROOT, 'assets/brand/icon.png')
const TARGET = resolve(ROOT, 'assets/brand/icon.ico')
const SIZES = [16, 32, 48, 256]

/** ICONDIR + one ICONDIRENTRY per image + the PNG bytes, little-endian (the Vista+ PNG-in-ICO form). */
function encodeIco(images) {
  const header = Buffer.alloc(6 + 16 * images.length)
  header.writeUInt16LE(0, 0)
  header.writeUInt16LE(1, 2)
  header.writeUInt16LE(images.length, 4)
  let offset = header.length
  images.forEach(({ size, png }, index) => {
    const at = 6 + 16 * index
    header.writeUInt8(size >= 256 ? 0 : size, at)
    header.writeUInt8(size >= 256 ? 0 : size, at + 1)
    header.writeUInt8(0, at + 2)
    header.writeUInt8(0, at + 3)
    header.writeUInt16LE(1, at + 4)
    header.writeUInt16LE(32, at + 6)
    header.writeUInt32LE(png.length, at + 8)
    header.writeUInt32LE(offset, at + 12)
    offset += png.length
  })
  return Buffer.concat([header, ...images.map((image) => image.png)])
}

const source = await readFile(SOURCE)
const images = await Promise.all(
  SIZES.map(async (size) => ({ size, png: await sharp(source).resize(size, size, { kernel: 'lanczos3' }).png({ compressionLevel: 9 }).toBuffer() })),
)
await writeFile(TARGET, encodeIco(images))
console.log(`wrote ${TARGET} (${SIZES.join(', ')} px)`)
