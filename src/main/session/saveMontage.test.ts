import { mkdtemp, readFile, readdir, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { saveMontage } from './saveMontage'

const at = () => new Date(2026, 10, 15, 21, 45, 8)

describe('saveMontage (RF12)', () => {
  it('writes HH-mm-ss.jpg, then -2 in the same second, and keeps existing files', async () => {
    const folder = await mkdtemp(join(tmpdir(), 'fotomagica-event-'))
    await writeFile(join(folder, 'notes.txt'), 'x')
    expect((await saveMontage(folder, new Uint8Array([1]), [], at)).fileName).toBe('21-45-08.jpg')
    expect((await saveMontage(folder, new Uint8Array([2]), [], at)).fileName).toBe('21-45-08-2.jpg')
    expect((await readdir(folder)).sort()).toEqual(['21-45-08-2.jpg', '21-45-08.jpg', 'notes.txt'])
    expect([...(await readFile(join(folder, '21-45-08.jpg')))]).toEqual([1])
  })

  it('writes the round originals to Originais/ with the montage name and _1 … _3, for the guests (DESIGN §17)', async () => {
    const folder = await mkdtemp(join(tmpdir(), 'fotomagica-event-'))
    const saved = await saveMontage(folder, new Uint8Array([9]), [[1, new Uint8Array([1])], [2, new Uint8Array([2])], [3, new Uint8Array([3])]], at)
    expect(saved.photos.map((photo) => [photo.index, photo.fileName])).toEqual([[1, '21-45-08_1.jpg'], [2, '21-45-08_2.jpg'], [3, '21-45-08_3.jpg']])
    expect((await readdir(join(folder, 'Originais'))).sort()).toEqual(['21-45-08_1.jpg', '21-45-08_2.jpg', '21-45-08_3.jpg'])
    expect([...(await readFile(join(folder, 'Originais', '21-45-08_2.jpg')))]).toEqual([2])
    // The montage listing stays only montages: the originals live in their own folder.
    expect((await readdir(folder)).sort()).toEqual(['21-45-08.jpg', 'Originais'])
  })

  it('still saves the montage when an original cannot be written, and logs it', async () => {
    const folder = await mkdtemp(join(tmpdir(), 'fotomagica-event-'))
    await writeFile(join(folder, 'Originais'), 'a file where the folder should be')
    const logged: string[] = []
    const saved = await saveMontage(folder, new Uint8Array([9]), [[1, new Uint8Array([1])]], at, (message) => logged.push(message))
    expect(saved.fileName).toBe('21-45-08.jpg')
    expect(saved.photos).toEqual([])
    expect(logged.length).toBeGreaterThan(0)
  })
})

