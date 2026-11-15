/**
 * Runtime switches read from environment variables. Pure: main passes `process.env` in.
 * E2E starts the app with `FOTOMAGICA_E2E=1` and `FOTOMAGICA_PRINTER=simulated` (DESIGN §10, §12).
 */

export type PrinterBackend = 'windows' | 'simulated'

/** Monitor list main uses under E2E instead of Electron's `screen` (DESIGN §3). */
export type DisplayFixture = 'portrait-tv' | 'landscape-tv' | 'laptop-only'

/** Chromium fake camera under E2E: its moving pattern, a `.y4m`/`.mjpeg` file, or no camera at all. */
export type CameraFixture = { kind: 'pattern' } | { kind: 'file'; path: string } | { kind: 'none' }

/** What the simulated printer answers (DESIGN §10): its status and whether the driver accepts the cut. */
export type SimulatedPrinterStatus = 'ready' | 'offline' | 'no-paper' | 'no-ribbon'
export type SimulatedPrinterFlags = { status: SimulatedPrinterStatus; cut: 'supported' | 'unsupported' }

export type RuntimeFlags = {
  /** Running under Playwright: fixtures replace the webcam and the second monitor, no auto-update. */
  e2e: boolean
  /** Which printer implementation `src/main/print/` uses. */
  printer: PrinterBackend
  /** Only read when `printer` is `simulated`: `FOTOMAGICA_PRINTER_STATUS` and `FOTOMAGICA_PRINTER_CUT`. */
  simulatedPrinter: SimulatedPrinterFlags
  /** Only read when `e2e` is true. */
  fixtures: {
    displays: DisplayFixture
    camera: CameraFixture
    /**
     * `FOTOMAGICA_USER_DATA` and `FOTOMAGICA_DESKTOP`: per-test folders that replace Electron's
     * `userData` and the Desktop, so E2E never touches the real ones. `null` keeps Electron's path.
     */
    paths: { userData: string | null; desktop: string | null }
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

const SIMULATED_STATUSES: readonly SimulatedPrinterStatus[] = ['ready', 'offline', 'no-paper', 'no-ribbon']

function readSimulatedPrinter(env: Env): SimulatedPrinterFlags {
  return {
    status: SIMULATED_STATUSES.find((status) => status === env['FOTOMAGICA_PRINTER_STATUS']) ?? 'ready',
    cut: env['FOTOMAGICA_PRINTER_CUT'] === 'unsupported' ? 'unsupported' : 'supported',
  }
}

/** The path as given, or `null`: an empty variable must not turn into the current folder. */
function readPath(value: string | undefined): string | null {
  return value && value.trim() !== '' ? value : null
}

export function readRuntimeFlags(env: Env): RuntimeFlags {
  const e2e = env['FOTOMAGICA_E2E'] === '1'
  const printer: PrinterBackend = env['FOTOMAGICA_PRINTER'] === 'simulated' ? 'simulated' : 'windows'
  return {
    e2e,
    printer,
    simulatedPrinter: readSimulatedPrinter(env),
    fixtures: {
      displays: readDisplayFixture(env['FOTOMAGICA_DISPLAYS']),
      camera: readCameraFixture(env['FOTOMAGICA_FAKE_CAMERA']),
      paths: { userData: readPath(env['FOTOMAGICA_USER_DATA']), desktop: readPath(env['FOTOMAGICA_DESKTOP']) },
    },
  }
}
