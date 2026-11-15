import { mkdtemp, readFile, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { SEED_LAYOUTS } from '@shared/layout'
import { CONFIG_FILE, parseConfig, readConfig, writeConfig } from './config'

const ref = { file: 'two-strips.png', fileName: 'Tema Festa.png' }

describe('config.json', () => {
  it('falls back to the seeds and no templates when the file is missing or broken', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'fotomagica-config-'))
    expect(await readConfig(dir)).toEqual({ layouts: SEED_LAYOUTS, templates: {} })
    await writeFile(join(dir, CONFIG_FILE), '{ not json')
    expect(await readConfig(dir)).toEqual({ layouts: SEED_LAYOUTS, templates: {} })
  })

  it('keeps a valid layout when the other one is invalid', () => {
    const custom = [{ id: 'photo-1', photo: 1, left: 0, top: 0, width: 600, height: 1240, angle: 0 }]
    const config = parseConfig({ layouts: { 'one-strip': custom, 'two-strips': [{ id: 'x', photo: 7 }] } })
    expect(config.layouts['one-strip']).toEqual(custom)
    expect(config.layouts['two-strips']).toEqual(SEED_LAYOUTS['two-strips'])
  })

  it('keeps one mode template when the other entry is invalid', () => {
    const config = parseConfig({ templates: { 'two-strips': ref, 'one-strip': { file: '../../evil.png', fileName: 'x' } } })
    expect(config.templates).toEqual({ 'two-strips': ref })
  })

  it('round-trips through disk', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'fotomagica-config-'))
    const config = { layouts: SEED_LAYOUTS, templates: { 'two-strips': ref } }
    await writeConfig(dir, config)
    expect(await readConfig(dir)).toEqual(config)
    expect(JSON.parse(await readFile(join(dir, CONFIG_FILE), 'utf8')).templates).toEqual({ 'two-strips': ref })
  })
})
