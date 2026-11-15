import { useEffect, useState } from 'react'
import type { PrinterStatus } from '@shared/ipc'

/** The DS-RX1 as main last read it, kept current by `printer:status-changed`. `null` until the first answer. */
export function usePrinterStatus(): PrinterStatus | null {
  const [status, setStatus] = useState<PrinterStatus | null>(null)

  useEffect(() => {
    let active = true
    let pushed = false
    const unsubscribe = window.fotomagica.printer.onStatus((value) => {
      pushed = true
      if (active) setStatus(value)
    })
    window.fotomagica.printer
      .getStatus()
      // An event that arrived first is newer than this answer.
      .then((value) => active && !pushed && setStatus(value))
      .catch(() => active && !pushed && setStatus({ kind: 'unknown', detail: 'printer:status failed' }))
    return () => {
      active = false
      unsubscribe()
    }
  }, [])

  return status
}
