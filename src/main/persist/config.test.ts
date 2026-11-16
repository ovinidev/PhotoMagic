import { mkdtemp, readFile, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { SEED_LAYOUTS } from '@shared/layout'
import { CONFIG_FILE, parseConfig, readConfig, saveLayout, saveWebcam, updateConfig, writeConfig } from './config'

const ref = { file: 'two-strips.png', fileName: 'Tema Festa.png' }
const NO_WEBCAM = { values: { controls: {} }, capabilities: null }

describe('config.json', () => {
  it('falls back to the seeds and no templates when the file is missing or broken', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'fotomagica-config-'))
    expect(await readConfig(dir)).toEqual({ layouts: SEED_LAYOUTS, templates: {}, webcam: NO_WEBCAM, zoom: 1 })
    await writeFile(join(dir, CONFIG_FILE), '{ not json')
    expect(await readConfig(dir)).toEqual({ layouts: SEED_LAYOUTS, templates: {}, webcam: NO_WEBCAM, zoom: 1 })
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
    const config = { layouts: SEED_LAYOUTS, templates: { 'two-strips': ref }, webcam: NO_WEBCAM, zoom: 1.25 }
    await writeConfig(dir, config)
    expect(await readConfig(dir)).toEqual(config)
    expect(JSON.parse(await readFile(join(dir, CONFIG_FILE), 'utf8')).templates).toEqual({ 'two-strips': ref })
  })

  it('saves one layout without touching the other or the templates (RF03)', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'fotomagica-config-'))
    await writeConfig(dir, { layouts: SEED_LAYOUTS, templates: { 'two-strips': ref }, webcam: NO_WEBCAM, zoom: 1 })
    const moved = SEED_LAYOUTS['one-strip'].map((slot) => (slot.id === 'photo-1' ? { ...slot, left: 60, photo: null } : slot))
    await saveLayout(dir, 'one-strip', moved)
    const read = await readConfig(dir)
    expect(read.layouts['one-strip']).toEqual(moved)
    expect(read.layouts['two-strips']).toEqual(SEED_LAYOUTS['two-strips'])
    expect(read.templates).toEqual({ 'two-strips': ref })
  })

  it('keeps the operator zoom of this computer and drops an invalid one alone (DESIGN §3)', () => {
    expect(parseConfig({ zoom: 1.5 }).zoom).toBe(1.5)
    expect(parseConfig({ zoom: 'huge' }).zoom).toBe(1)
    expect(parseConfig({ zoom: 40, templates: { 'two-strips': ref } }).templates).toEqual({ 'two-strips': ref })
    expect(parseConfig({}).zoom).toBe(1)
  })

  it('applies changes that land together one after the other', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'fotomagica-config-'))
    const moved = SEED_LAYOUTS['two-strips'].map((slot) => ({ ...slot, top: slot.top + 1 }))
    await Promise.all([
      updateConfig(dir, (config) => ({ ...config, templates: { 'two-strips': ref } })),
      saveLayout(dir, 'two-strips', moved),
    ])
    const read = await readConfig(dir)
    expect(read.templates).toEqual({ 'two-strips': ref })
    expect(read.layouts['two-strips']).toEqual(moved)
  })

  it('keeps the webcam values and the last advertised controls, and drops a broken entry alone (RF15, RNF11)', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'fotomagica-config-'))
    await writeConfig(dir, { layouts: SEED_LAYOUTS, templates: { 'two-strips': ref }, webcam: NO_WEBCAM, zoom: 1 })
    const capabilities = { controls: { brightness: { key: 'brightness', min: 0, max: 255, step: 1 } }, whiteBalanceModes: [], powerLineFrequency: false }
    await saveWebcam(dir, { values: { controls: { brightness: 140 } }, capabilities })
    const config = await readConfig(dir)
    expect(config.webcam).toEqual({ values: { controls: { brightness: 140 } }, capabilities })
    expect(config.templates).toEqual({ 'two-strips': ref })
    expect(parseConfig({ webcam: { values: { controls: { brightness: 'x' } }, capabilities } }).webcam).toEqual({ values: { controls: {} }, capabilities })
  })
})
