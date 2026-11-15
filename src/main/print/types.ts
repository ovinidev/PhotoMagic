import { cutFor, type PrintMode } from '@shared/layout'

/** Printer interface (DESIGN §10). Only `src/main/print/` knows the driver, the spooler or the simulation. */

export type PrinterStatus =
  | { kind: 'ready' }
  | { kind: 'offline' }
  | { kind: 'no-paper' }
  | { kind: 'no-ribbon' }
  | { kind: 'unknown'; detail: string }

export type PrintTicket = {
  jpegPath: string
  copies: number
  mode: PrintMode
  cut: boolean
}

export type PrintResult =
  | { ok: true }
  | { ok: false; reason: 'offline' | 'no-paper' | 'no-ribbon' | 'cut-unavailable' | 'failed'; detail: string }

export type Printer = {
  status: () => Promise<PrinterStatus>
  print: (ticket: PrintTicket) => Promise<PrintResult>
}

/** The ticket for a montage: `two-strips` asks for the 2" cut, `one-strip` asks for no cut (RF11). */
export function ticketFor(jpegPath: string, copies: number, mode: PrintMode): PrintTicket {
  return { jpegPath, copies, mode, cut: cutFor(mode) }
}
