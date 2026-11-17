import { join } from 'node:path'
import type { RuntimeFlags, SimulatedPrinterFlags } from '@shared/runtime'
import { createFileLog } from '../persist/log'
import { createSimulatedPrinter } from './SimulatedPrinter'
import { createWindowsDnpPrinter } from './WindowsDnpPrinter'
import type { Printer } from './types'

export { createPrinterMonitor, type PrinterMonitor } from './monitor'
export { ticketFor, type Printer, type PrinterStatus, type PrintResult, type PrintTicket } from './types'

export type PrinterHandle = {
  printer: Printer
  /** How often the status is polled: the simulation is free to read, the spooler goes through PowerShell. */
  pollMs: number
  /** Only for the simulated printer (E2E hook); `null` for the DS-RX1. */
  setSimulated: ((next: Partial<SimulatedPrinterFlags>) => void) | null
  /** Stops the Windows helper process on quit. */
  dispose: () => void
}

/** The DS-RX1 log under `userData/logs/`: each print sent and every helper stderr line. */
export const PRINT_LOG = 'print.log'

/** Picks the implementation from `FOTOMAGICA_PRINTER`. The simulated one writes under `userData/simulated-prints/`. */
export function createPrinter(flags: RuntimeFlags, userData: string): PrinterHandle {
  if (flags.printer === 'simulated') {
    const printer = createSimulatedPrinter({ dir: join(userData, 'simulated-prints'), flags: flags.simulatedPrinter })
    return { printer, pollMs: 250, setSimulated: printer.setFlags, dispose: () => {} }
  }
  const log = createFileLog(userData, PRINT_LOG)
  const printer = createWindowsDnpPrinter({ helperDir: join(userData, 'helpers'), file: (line) => log('info', line) })
  return { printer, pollMs: 5_000, setSimulated: null, dispose: printer.dispose }
}
