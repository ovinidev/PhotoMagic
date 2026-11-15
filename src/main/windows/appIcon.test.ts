import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import sharp from 'sharp'
import { describe, expect, it } from 'vitest'

const ICO = resolve(import.meta.dirname, '../../../assets/brand/icon.ico')

describe('app icon (RNF12)', () => {
  it('icon.ico holds the symbol at 16, 32, 48 and 256 px, as PNG entries', async () => {
    const bytes = await readFile(ICO)
    expect(bytes.readUInt16LE(2)).toBe(1)
    const count = bytes.readUInt16LE(4)
    const sizes: number[] = []
    for (let index = 0; index < count; index++) {
      const at = 6 + 16 * index
      const declared = bytes.readUInt8(at) || 256
      const length = bytes.readUInt32LE(at + 8)
      const offset = bytes.readUInt32LE(at + 12)
      const meta = await sharp(bytes.subarray(offset, offset + length)).metadata()
      expect(meta).toMatchObject({ format: 'png', width: declared, height: declared })
      sizes.push(declared)
    }
    expect(sizes).toEqual([16, 32, 48, 256])
  })
})
