import { copyFile, mkdir, readdir, writeFile } from 'node:fs/promises'
import { basename, join } from 'node:path'
import type { SimulatedPrinterFlags } from '@shared/runtime'
import type { Printer, PrinterStatus } from './types'

/**
 * `FOTOMAGICA_PRINTER=simulated` (DESIGN §10): no driver, no dialog. Each accepted print copies the
 * JPEG to `<dir>/NNN-<name>.jpg` and writes the ticket next to it as `NNN-<name>.json`.
 * `FOTOMAGICA_PRINTER_STATUS` forces a printer state and `FOTOMAGICA_PRINTER_CUT=unsupported` makes
 * the driver refuse the cut.
 */
export function createSimulatedPrinter({ dir, flags }: { dir: string; flags: SimulatedPrinterFlags }): Printer {
  const status = (): PrinterStatus => ({ kind: flags.status })

  return {
    status: async () => status(),
    print: async (ticket) => {
      if (flags.status !== 'ready') return { ok: false, reason: flags.status, detail: 'simulated' }
      if (flags.cut === 'unsupported') {
        return { ok: false, reason: 'cut-unavailable', detail: ticket.cut ? 'simulated driver refuses 2inch cut Enable' : 'simulated driver refuses 2inch cut Disable' }
      }
      try {
        await mkdir(dir, { recursive: true })
        const count = (await readdir(dir)).filter((name) => name.endsWith('.json')).length
        const stem = `${String(count + 1).padStart(3, '0')}-${basename(ticket.jpegPath, '.jpg')}`
        await copyFile(ticket.jpegPath, join(dir, `${stem}.jpg`))
        await writeFile(join(dir, `${stem}.json`), JSON.stringify(ticket, null, 2))
        return { ok: true }
      } catch (error) {
        return { ok: false, reason: 'failed', detail: error instanceof Error ? error.message : String(error) }
      }
    },
  }
}
