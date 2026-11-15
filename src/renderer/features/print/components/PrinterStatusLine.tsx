import { cn } from '@renderer/shared/utils/cn'
import { PRINT_COPY } from '../copy'
import { usePrinterStatus } from '../hooks/usePrinterStatus'

const DOT = { ok: 'bg-ok', danger: 'bg-danger', neutral: 'bg-ink-soft/40' } as const

/**
 * Laptop: one line with the printer state (PRD §6.3, DESIGN §10). Green only when the spooler
 * reports no error; anything else is red, including "the driver did not report".
 */
export function PrinterStatusLine() {
  const status = usePrinterStatus()
  const tone = status === null ? 'neutral' : status.kind === 'ready' ? 'ok' : 'danger'
  const title = PRINT_COPY.status[status?.kind ?? 'checking']
  const detail = status && 'detail' in status ? status.detail : null
  return (
    <div role="status" aria-live="polite" data-testid="printer-status" data-kind={status?.kind ?? 'checking'} className="flex items-start gap-3">
      <span aria-hidden className={cn('mt-1.5 size-2.5 shrink-0 rounded-full', DOT[tone])} />
      <div>
        <p className={cn('font-medium', tone === 'danger' ? 'text-danger' : 'text-ink')}>{title}</p>
        {detail ? <p className="text-sm text-ink-soft">{PRINT_COPY.technicalDetail(detail)}</p> : null}
      </div>
    </div>
  )
}
