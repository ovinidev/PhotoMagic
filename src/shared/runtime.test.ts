import { describe, expect, it } from 'vitest'
import { readRuntimeFlags } from './runtime'

const defaultFixtures = { displays: 'portrait-tv', camera: { kind: 'pattern' }, paths: { userData: null, desktop: null } }
const simulatedPrinter = { status: 'ready', cut: 'supported', delayMs: 0 }

describe('readRuntimeFlags', () => {
  it('defaults to production: no E2E and the Windows printer', () => {
    expect(readRuntimeFlags({})).toEqual({ e2e: false, printer: 'windows', simulatedPrinter, fixtures: defaultFixtures })
  })

  it('reads the E2E contract', () => {
    expect(readRuntimeFlags({ FOTOMAGICA_E2E: '1', FOTOMAGICA_PRINTER: 'simulated' })).toEqual({
      e2e: true,
      printer: 'simulated',
      simulatedPrinter,
      fixtures: defaultFixtures,
    })
  })

  it('ignores values outside the contract', () => {
    expect(
      readRuntimeFlags({ FOTOMAGICA_E2E: 'true', FOTOMAGICA_PRINTER: 'fake', FOTOMAGICA_DISPLAYS: 'three-tvs' }),
    ).toEqual({ e2e: false, printer: 'windows', simulatedPrinter, fixtures: defaultFixtures })
  })

  it('reads the monitor fixture', () => {
    expect(readRuntimeFlags({ FOTOMAGICA_DISPLAYS: 'laptop-only' }).fixtures.displays).toBe('laptop-only')
    expect(readRuntimeFlags({ FOTOMAGICA_DISPLAYS: 'landscape-tv' }).fixtures.displays).toBe('landscape-tv')
  })

  it('reads the camera fixture: no camera, or a video file', () => {
    expect(readRuntimeFlags({ FOTOMAGICA_FAKE_CAMERA: 'none' }).fixtures.camera).toEqual({ kind: 'none' })
    expect(readRuntimeFlags({ FOTOMAGICA_FAKE_CAMERA: '/tmp/MX Brio fixture.y4m' }).fixtures.camera).toEqual({
      kind: 'file',
      path: '/tmp/MX Brio fixture.y4m',
    })
  })

  it('reads the per-test userData and Desktop folders, ignoring empty values', () => {
    expect(readRuntimeFlags({ FOTOMAGICA_USER_DATA: '/tmp/u', FOTOMAGICA_DESKTOP: '/tmp/d' }).fixtures.paths).toEqual({
      userData: '/tmp/u',
      desktop: '/tmp/d',
    })
    expect(readRuntimeFlags({ FOTOMAGICA_USER_DATA: ' ', FOTOMAGICA_DESKTOP: '' }).fixtures.paths).toEqual({ userData: null, desktop: null })
  })

  it('reads what the simulated printer answers', () => {
    expect(readRuntimeFlags({ FOTOMAGICA_PRINTER_STATUS: 'no-paper', FOTOMAGICA_PRINTER_CUT: 'unsupported' }).simulatedPrinter).toEqual({
      status: 'no-paper',
      cut: 'unsupported',
      delayMs: 0,
    })
    expect(readRuntimeFlags({ FOTOMAGICA_PRINTER_STATUS: 'jammed' }).simulatedPrinter.status).toBe('ready')
  })
})
