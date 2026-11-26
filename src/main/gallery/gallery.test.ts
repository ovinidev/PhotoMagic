import { mkdtempSync, rmSync, utimesSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import sharp from 'sharp'
import { describe, expect, it } from 'vitest'
import { THUMBNAIL_WIDTH, listMontages, montagePath, readMontage } from './gallery'

async function folderWith(files: Record<string, Buffer | string>) {
  const folder = mkdtempSync(join(tmpdir(), 'fotomagica-gallery-'))
  let time = 1_700_000_000
  for (const [name, content] of Object.entries(files)) {
    writeFileSync(join(folder, name), content)
    utimesSync(join(folder, name), time, time)
    time += 10
  }
  return folder
}

const jpeg = () => sharp({ create: { width: 1844, height: 1240, channels: 3, background: '#336699' } }).jpeg().toBuffer()

describe('gallery (RF14)', () => {
  it('lists only the app montages, newest first', async () => {
    const folder = await folderWith({ '21-45-08.jpg': await jpeg(), 'foto.png': 'x', 'notes.txt': 'x', 'IMG_0001.jpg': 'x', '21-45-08-2.jpg': await jpeg() })
    expect(await listMontages(folder)).toEqual(['21-45-08-2.jpg', '21-45-08.jpg'])
    expect(await listMontages(join(folder, 'missing'))).toEqual([])
  })

  it('shares a generated thumbnail across requests and refreshes it when the file changes', async () => {
    const name = '10-00-00.jpg'
    const folder = await folderWith({ [name]: await jpeg() })
    const path = join(folder, name)
    try {
      const [first, concurrent] = await Promise.all([
        readMontage(folder, name, 'thumb'),
        readMontage(folder, name, 'thumb'),
      ])
      expect(first).toBeInstanceOf(Uint8Array)
      expect(concurrent).toBe(first)
      expect(await readMontage(folder, name, 'thumb')).toBe(first)

      const replacement = await sharp({ create: { width: 600, height: 300, channels: 3, background: '#ff8800' } }).jpeg().toBuffer()
      writeFileSync(path, replacement)
      const refreshed = await readMontage(folder, name, 'thumb')
      expect(refreshed).not.toEqual(first)
      expect((await sharp(refreshed!).metadata()).height).toBe(240)

      rmSync(path)
      expect(await readMontage(folder, name, 'thumb')).toBeNull()
    } finally {
      rmSync(folder, { recursive: true, force: true })
    }
  })

  it('reads a montage or its thumbnail, and refuses any other name', async () => {
    const folder = await folderWith({ '10-00-00.jpg': await jpeg() })
    const thumb = await readMontage(folder, '10-00-00.jpg', 'thumb')
    expect((await sharp(thumb!).metadata()).width).toBe(THUMBNAIL_WIDTH)
    expect((await sharp((await readMontage(folder, '10-00-00.jpg', 'full'))!).metadata()).width).toBe(1844)
    expect(await readMontage(folder, '11-00-00.jpg', 'full')).toBeNull()
    expect(montagePath(folder, '../secret.jpg')).toBeNull()
    expect(montagePath(folder, 'foto.png')).toBeNull()
  })
})
