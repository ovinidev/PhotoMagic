/**
 * Runtime switches read from environment variables. Pure: main passes `process.env` in.
 * E2E starts the app with `FOTOMAGICA_E2E=1` and `FOTOMAGICA_PRINTER=simulated` (DESIGN §10, §12).
 */

export type PrinterBackend = 'windows' | 'simulated'

export type RuntimeFlags = {
  /** Running under Playwright: fixtures replace the webcam and the second monitor, no auto-update. */
  e2e: boolean
  /** Which printer implementation `src/main/print/` uses. */
  printer: PrinterBackend
}

type Env = Readonly<Record<string, string | undefined>>

export function readRuntimeFlags(env: Env): RuntimeFlags {
  const e2e = env['FOTOMAGICA_E2E'] === '1'
  const printer: PrinterBackend = env['FOTOMAGICA_PRINTER'] === 'simulated' ? 'simulated' : 'windows'
  return { e2e, printer }
}
