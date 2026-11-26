import { PRINT_COPY } from '../copy'
import { usePrinterStatus } from '../hooks/usePrinterStatus'

/**
 * Laptop header, during an event: a red pill with the printer problem, next to `Encerrar evento`, so
 * the operator sees it without scrolling to the printer line. Nothing while the printer is ready or
 * still being checked.
 */
export function PrinterAlert() {
  const status = usePrinterStatus()
  if (!status || status.kind === 'ready') return null
  return (
    <p role="alert" data-testid="header-printer-alert" className="max-w-64 truncate rounded-full bg-danger px-3 py-1 text-[13px] font-semibold text-white">
      {PRINT_COPY.status[status.kind]}
    </p>
  )
}
