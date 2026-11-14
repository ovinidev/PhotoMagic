import { describe, expect, it } from 'vitest'
import { readRuntimeFlags } from './runtime'

describe('readRuntimeFlags', () => {
  it('defaults to production: no E2E and the Windows printer', () => {
    expect(readRuntimeFlags({})).toEqual({ e2e: false, printer: 'windows' })
  })

  it('reads the E2E contract', () => {
    expect(readRuntimeFlags({ FOTOMAGICA_E2E: '1', FOTOMAGICA_PRINTER: 'simulated' })).toEqual({
      e2e: true,
      printer: 'simulated',
    })
  })

  it('ignores values outside the contract', () => {
    expect(readRuntimeFlags({ FOTOMAGICA_E2E: 'true', FOTOMAGICA_PRINTER: 'fake' })).toEqual({
      e2e: false,
      printer: 'windows',
    })
  })
})
