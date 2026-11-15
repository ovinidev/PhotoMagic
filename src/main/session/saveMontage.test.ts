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
    expect((await saveMontage(folder, new Uint8Array([1]), at)).fileName).toBe('21-45-08.jpg')
    expect((await saveMontage(folder, new Uint8Array([2]), at)).fileName).toBe('21-45-08-2.jpg')
    expect((await readdir(folder)).sort()).toEqual(['21-45-08-2.jpg', '21-45-08.jpg', 'notes.txt'])
    expect([...(await readFile(join(folder, '21-45-08.jpg')))]).toEqual([1])
  })
})
