import type { Printer, PrinterStatus } from './types'

export type PrinterMonitor = {
  /** Reads the status now; concurrent calls share one read. Notifies on a change. */
  refresh: () => Promise<PrinterStatus>
  /** The last status read, `null` before the first. */
  current: () => PrinterStatus | null
  stop: () => void
}

const same = (a: PrinterStatus | null, b: PrinterStatus) => a !== null && JSON.stringify(a) === JSON.stringify(b)

/**
 * Polls the printer and reports changes (`printer:status-changed`, DESIGN §4). Polling, because the
 * spooler has no push the helper could forward without a second process. The first read happens
 * right away.
 */
export function createPrinterMonitor({ printer, intervalMs, onChange }: { printer: Pick<Printer, 'status'>; intervalMs: number; onChange: (status: PrinterStatus) => void }): PrinterMonitor {
  let current: PrinterStatus | null = null
  let inflight: Promise<PrinterStatus> | null = null

  const refresh = () => {
    inflight ??= printer
      .status()
      .catch((error: unknown): PrinterStatus => ({ kind: 'unknown', detail: error instanceof Error ? error.message : String(error) }))
      .then((status) => {
        inflight = null
        if (!same(current, status)) {
          current = status
          onChange(status)
        }
        return status
      })
    return inflight
  }

  void refresh()
  const timer = setInterval(() => void refresh(), intervalMs)
  return { refresh, current: () => current, stop: () => clearInterval(timer) }
}
