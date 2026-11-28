import { mkdtemp, readdir } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import sharp from 'sharp'
import { describe, expect, it } from 'vitest'
import { guideBoxes } from '@shared/layout'
import { readConfig, saveBoxes } from './config'
import { importTemplate, listTemplates, readTemplate } from './templates'

const image = (width: number, height: number, format: 'png' | 'jpeg' | 'webp' = 'png') =>
  sharp({ create: { width, height, channels: 3, background: '#808080' } }).toFormat(format).toBuffer()

describe('templates (RF01)', () => {
  it('stores a 1844×1240 PNG for its mode only', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'fotomagica-tpl-'))
    const result = await importTemplate(dir, 'two-strips', 'Tema.png', await image(1844, 1240))
    expect(result).toMatchObject({ ok: true, template: { mode: 'two-strips', fileName: 'Tema.png', width: 1844, height: 1240 } })
    expect(await readdir(join(dir, 'templates'))).toEqual(['two-strips.png'])
    const all = await listTemplates(dir)
    expect(all['two-strips']?.fileName).toBe('Tema.png')
    expect(all['one-strip']).toBeNull()
  })

  it('keeps each mode separate, even for the same file', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'fotomagica-tpl-'))
    await importTemplate(dir, 'two-strips', 'A.png', await image(1844, 1240))
    await importTemplate(dir, 'one-strip', 'B.jpg', await image(1844, 1240, 'jpeg'))
    expect((await readTemplate(dir, 'two-strips'))?.fileName).toBe('A.png')
    expect((await readTemplate(dir, 'one-strip'))?.fileName).toBe('B.jpg')
  })

  it('a new template drops that mode fixed boxes only: each template keeps its own (DESIGN §6)', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'fotomagica-tpl-'))
    await saveBoxes(dir, 'two-strips', guideBoxes('two-strips'))
    await saveBoxes(dir, 'one-strip', guideBoxes('one-strip'))
    await importTemplate(dir, 'two-strips', 'A.png', await image(1844, 1240))
    expect((await readConfig(dir)).boxes).toEqual({ 'one-strip': guideBoxes('one-strip') })
  })

  it('rejects another size with the size read, and keeps the previous template', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'fotomagica-tpl-'))
    await importTemplate(dir, 'two-strips', 'A.png', await image(1844, 1240))
    expect(await importTemplate(dir, 'two-strips', 'B.png', await image(1200, 1800))).toEqual({ ok: false, reason: 'size', width: 1200, height: 1800 })
    expect((await readTemplate(dir, 'two-strips'))?.fileName).toBe('A.png')
  })

  it('rejects other formats and unreadable bytes', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'fotomagica-tpl-'))
    expect(await importTemplate(dir, 'one-strip', 'a.webp', await image(1844, 1240, 'webp'))).toEqual({ ok: false, reason: 'format' })
    expect(await importTemplate(dir, 'one-strip', 'a.png', new Uint8Array([1, 2, 3]))).toEqual({ ok: false, reason: 'unreadable' })
    // A PDF (like the client's Canva export) gets its own reason, and nothing is stored.
    expect(await importTemplate(dir, 'two-strips', 'template.pdf', new TextEncoder().encode('%PDF-1.4\n1 0 obj'))).toEqual({ ok: false, reason: 'pdf' })
    expect(await listTemplates(dir)).toMatchObject({ 'two-strips': null })
  })
})
