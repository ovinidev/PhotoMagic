import { z } from 'zod'

/**
 * The operator's printer settings (DESIGN §10, printer screen): the 2" cut per print mode and
 * whether the app puts the queue's Windows printing preferences back after each print. Since the
 * helper prints on those preferences (it saves paper, orientation and cut there), leaving them would
 * make every other app on the laptop print with the cut too.
 */
export const printerSettingsSchema = z.strictObject({
  cut: z.strictObject({ 'two-strips': z.boolean(), 'one-strip': z.boolean() }),
  restorePreferences: z.boolean(),
})

export type PrinterSettings = z.infer<typeof printerSettingsSchema>

/** 2 tiras cuts, 1 tira does not (RF11); the Windows preferences go back after each print. */
export function defaultPrinterSettings(): PrinterSettings {
  return { cut: { 'two-strips': true, 'one-strip': false }, restorePreferences: true }
}

/**
 * What a read of the printer finds, changing nothing: the queue in use, its state and the printing
 * preferences Windows has saved for it now, as the driver names them (`(6x4)`, `Retrato`,
 * `Enable (Printer V.1.10 or later)`). `preferences` is `null` when they could not be read.
 */
export const printerReportSchema = z.strictObject({
  queue: z.string().max(260).nullable(),
  preferences: z
    .strictObject({
      paper: z.string().max(260).nullable(),
      orientation: z.string().max(260).nullable(),
      cut: z.string().max(260).nullable(),
    })
    .nullable(),
  detail: z.string().max(1000).nullable(),
})

export type PrinterReport = z.infer<typeof printerReportSchema>
