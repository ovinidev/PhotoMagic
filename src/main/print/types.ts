import type { PrintFailureReason, PrinterStatus } from '@shared/ipc'
import { cutFor, type PrintMode } from '@shared/layout'

/** Printer interface (DESIGN §10). Only `src/main/print/` knows the driver, the spooler or the simulation. */

export type { PrinterStatus }

export type PrintTicket = {
  jpegPath: string
  copies: number
  mode: PrintMode
  cut: boolean
}

export type PrintResult =
  | { ok: true }
  | { ok: false; reason: PrintFailure; detail: string }

/** Every failure reason except `save-failed`, which belongs to the session (the JPG was not written). */
export type PrintFailure = Exclude<PrintFailureReason, 'save-failed'>

export type Printer = {
  status: () => Promise<PrinterStatus>
  print: (ticket: PrintTicket) => Promise<PrintResult>
}

/** The ticket for a montage: `two-strips` asks for the 2" cut, `one-strip` asks for no cut (RF11). */
export function ticketFor(jpegPath: string, copies: number, mode: PrintMode): PrintTicket {
  return { jpegPath, copies, mode, cut: cutFor(mode) }
}
