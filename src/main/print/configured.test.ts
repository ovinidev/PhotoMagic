import { describe, expect, it, vi } from 'vitest'
import { defaultPrinterSettings, type PrinterSettings } from '@shared/printerSettings'
import { withPrinterSettings } from './configured'
import type { Printer } from './types'

const inner = (): Printer => ({
  status: vi.fn(async () => ({ kind: 'ready' as const })),
  print: vi.fn(async () => ({ ok: true as const })),
  inspect: vi.fn(async () => ({ queue: 'DS-RX1', preferences: null, detail: null })),
})

describe('withPrinterSettings (printer screen)', () => {
  it('applies the cut chosen for the ticket mode and the restore choice, read at each print', async () => {
    const printer = inner()
    let settings: PrinterSettings = defaultPrinterSettings()
    const configured = withPrinterSettings(printer, () => settings)
    await configured.print({ jpegPath: 'a.jpg', copies: 1, mode: 'two-strips', cut: false })
    expect(printer.print).toHaveBeenLastCalledWith({ jpegPath: 'a.jpg', copies: 1, mode: 'two-strips', cut: true, restorePreferences: true })
    settings = { cut: { 'two-strips': false, 'one-strip': true }, restorePreferences: false }
    await configured.print({ jpegPath: 'b.jpg', copies: 2, mode: 'two-strips', cut: true })
    expect(printer.print).toHaveBeenLastCalledWith({ jpegPath: 'b.jpg', copies: 2, mode: 'two-strips', cut: false, restorePreferences: false })
    await configured.print({ jpegPath: 'c.jpg', copies: 1, mode: 'one-strip', cut: false })
    expect(printer.print).toHaveBeenLastCalledWith(expect.objectContaining({ mode: 'one-strip', cut: true }))
  })

  it('passes status and inspect through untouched', async () => {
    const printer = inner()
    const configured = withPrinterSettings(printer, defaultPrinterSettings)
    expect(await configured.status()).toEqual({ kind: 'ready' })
    expect(await configured.inspect()).toEqual({ queue: 'DS-RX1', preferences: null, detail: null })
  })
})
