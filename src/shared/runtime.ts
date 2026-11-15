/**
 * Runtime switches read from environment variables. Pure: main passes `process.env` in.
 * E2E starts the app with `FOTOMAGICA_E2E=1` and `FOTOMAGICA_PRINTER=simulated` (DESIGN §10, §12).
 */

export type PrinterBackend = 'windows' | 'simulated'

/** Monitor list main uses under E2E instead of Electron's `screen` (DESIGN §3). */
export type DisplayFixture = 'portrait-tv' | 'landscape-tv' | 'laptop-only'

/** Chromium fake camera under E2E: its moving pattern, a `.y4m`/`.mjpeg` file, or no camera at all. */
export type CameraFixture = { kind: 'pattern' } | { kind: 'file'; path: string } | { kind: 'none' }

export type RuntimeFlags = {
  /** Running under Playwright: fixtures replace the webcam and the second monitor, no auto-update. */
  e2e: boolean
  /** Which printer implementation `src/main/print/` uses. */
  printer: PrinterBackend
  /** Only read when `e2e` is true. */
  fixtures: {
    displays: DisplayFixture
    camera: CameraFixture
  }
}

type Env = Readonly<Record<string, string | undefined>>

const DISPLAY_FIXTURES: readonly DisplayFixture[] = ['portrait-tv', 'landscape-tv', 'laptop-only']

function readDisplayFixture(value: string | undefined): DisplayFixture {
  return DISPLAY_FIXTURES.find((fixture) => fixture === value) ?? 'portrait-tv'
}

function readCameraFixture(value: string | undefined): CameraFixture {
  if (!value) return { kind: 'pattern' }
  if (value === 'none') return { kind: 'none' }
  return { kind: 'file', path: value }
}

export function readRuntimeFlags(env: Env): RuntimeFlags {
  const e2e = env['FOTOMAGICA_E2E'] === '1'
  const printer: PrinterBackend = env['FOTOMAGICA_PRINTER'] === 'simulated' ? 'simulated' : 'windows'
  return {
    e2e,
    printer,
    fixtures: {
      displays: readDisplayFixture(env['FOTOMAGICA_DISPLAYS']),
      camera: readCameraFixture(env['FOTOMAGICA_FAKE_CAMERA']),
    },
  }
}
