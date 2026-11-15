import type { Printer } from './types'

/**
 * The DS-RX1 on the Windows spooler (DESIGN §10). Silent printing with the 2" cut flag lands in the
 * next milestone; until then `Imprimir` writes the montage and reports that the print was not sent,
 * so the round stays on the print screen instead of pretending a sheet came out.
 */
export function createWindowsDnpPrinter(): Printer {
  const detail = 'Impressão na DS-RX1 ainda não implementada'
  return {
    status: async () => ({ kind: 'unknown', detail }),
    print: async () => ({ ok: false, reason: 'failed', detail }),
  }
}
