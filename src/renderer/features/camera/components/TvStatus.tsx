import { cn } from '@renderer/shared/utils/cn'
import { TV_COPY } from '../copy'
import type { DisplayStateView } from '../hooks/useDisplayState'

type View = { tone: 'ok' | 'warning' | 'danger' | 'neutral'; title: string; detail: string }

const size = (display: { width: number; height: number }) => `${display.width} × ${display.height}`

/** What the laptop says about the TV for each monitor and TV window state (RF04, DESIGN §3). */
export function describeTv(view: DisplayStateView): View {
  if (view.status === 'loading') return { tone: 'neutral', ...TV_COPY.loading }
  if (view.status === 'error') return { tone: 'danger', ...TV_COPY.readError }
  const { guest, tv } = view.value
  if (tv.kind === 'open') return { tone: 'ok', title: TV_COPY.open.title, detail: TV_COPY.open.detail(size(tv.display)) }
  if (tv.kind === 'detached') return { tone: 'danger', ...TV_COPY.detached[tv.reason] }
  switch (guest.kind) {
    case 'portrait':
      return { tone: 'ok', title: TV_COPY.found.title, detail: TV_COPY.found.detail(size(guest.display)) }
    case 'landscape-external':
      return { tone: 'warning', ...TV_COPY.landscape }
    case 'missing':
      return { tone: 'danger', ...TV_COPY.missing }
  }
}

const DOT = { ok: 'bg-ok', warning: 'bg-danger', danger: 'bg-danger', neutral: 'bg-ink-soft/40' } as const

/** Laptop: one line with the TV monitor and window state. `Iniciar evento` opens the TV; this only reports. */
export function TvStatus({ view }: { view: DisplayStateView }) {
  const line = describeTv(view)
  return (
    <div role="status" aria-live="polite" data-testid="tv-status" className="flex items-start gap-3">
      <span aria-hidden className={cn('mt-1.5 size-2.5 shrink-0 rounded-full', DOT[line.tone])} />
      <div>
        <p className={cn('font-medium', line.tone === 'danger' ? 'text-danger' : 'text-ink')}>{line.title}</p>
        <p className="text-sm text-ink-soft tabular-nums">{line.detail}</p>
      </div>
    </div>
  )
}
