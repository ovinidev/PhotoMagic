import { join } from 'node:path'
import type { RuntimeFlags } from '@shared/runtime'
import { createSimulatedPrinter } from './SimulatedPrinter'
import { createWindowsDnpPrinter } from './WindowsDnpPrinter'
import type { Printer } from './types'

export { ticketFor, type Printer, type PrinterStatus, type PrintResult, type PrintTicket } from './types'

/** Picks the implementation from `FOTOMAGICA_PRINTER`. The simulated one writes under `userData/simulated-prints/`. */
export function createPrinter(flags: RuntimeFlags, userData: string): Printer {
  return flags.printer === 'simulated'
    ? createSimulatedPrinter({ dir: join(userData, 'simulated-prints'), flags: flags.simulatedPrinter })
    : createWindowsDnpPrinter({ helperDir: join(userData, 'helpers') })
}
