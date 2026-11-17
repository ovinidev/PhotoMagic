import { mkdtemp } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import sharp from 'sharp'
import { describe, expect, it } from 'vitest'
import { renderSheet } from '../compose/renderSheet'
import { SEED_LAYOUTS } from '@shared/layout'
import { importTemplate, readTemplate } from './templates'

describe('importTemplate with a truncated file', () => {
  it('refuses a 1844×1240 PNG whose pixel data is cut off, and keeps nothing', async () => {
    const userData = await mkdtemp(join(tmpdir(), 'fm-review-'))
    const full = await sharp({ create: { width: 1844, height: 1240, channels: 3, background: '#3366cc' } }).png().toBuffer()
    const truncated = full.subarray(0, Math.floor(full.length / 2))
    const result = await importTemplate(userData, 'two-strips', 'fundo.png', truncated).catch((error: Error) => `threw: ${error.message}`)
    expect(result).toEqual({ ok: false, reason: 'unreadable' })
    const stored = await readTemplate(userData, 'two-strips')
    expect(stored).toBeNull()
    if (stored) await renderSheet({ mode: 'two-strips', template: stored.bytes, slots: SEED_LAYOUTS['two-strips'], photos: {} }, { kind: 'montage' })
  })
})
