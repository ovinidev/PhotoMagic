import type { PrinterSettings } from '@shared/printerSettings'
import type { Printer } from './types'

/**
 * The printer with the operator's printer screen applied (DESIGN §10): each ticket gets the 2" cut
 * chosen for its mode and whether the Windows preferences go back after the job. Read at every
 * print, so a change applies to the next one.
 */
export function withPrinterSettings(printer: Printer, settings: () => PrinterSettings): Printer {
  return {
    status: () => printer.status(),
    inspect: () => printer.inspect(),
    print: (ticket) => {
      const current = settings()
      return printer.print({ ...ticket, cut: current.cut[ticket.mode], restorePreferences: current.restorePreferences })
    },
  }
}
