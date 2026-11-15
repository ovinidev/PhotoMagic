import { useState } from 'react'
import type { DisplayState } from '@shared/ipc'
import { Button } from '@renderer/shared/components/ui/button'
import { cn } from '@renderer/shared/utils/cn'
import { TV_COPY } from '../copy'
import { useDisplayState, type DisplayStateView } from '../hooks/useDisplayState'
import { CameraStatusLine } from './CameraStatusLine'

type Action = 'open' | 'open-landscape' | 'close' | 'none'
type View = { tone: 'ok' | 'warning' | 'danger' | 'neutral'; title: string; detail: string; action: Action }

const size = (display: { width: number; height: number }) => `${display.width} × ${display.height}`

/** What the card says and offers for each TV state (RF04, DESIGN §3). */
function describeTv(view: DisplayStateView): View {
  if (view.status === 'loading') return { tone: 'neutral', ...TV_COPY.loading, action: 'none' }
  if (view.status === 'error') return { tone: 'danger', ...TV_COPY.readError, action: 'none' }
  const { guest, tv } = view.value
  if (tv.kind === 'open') return { tone: 'ok', title: TV_COPY.open.title, detail: TV_COPY.open.detail(size(tv.display)), action: 'close' }
  if (tv.kind === 'detached') return { tone: 'danger', ...TV_COPY.detached[tv.reason], action: 'close' }
  switch (guest.kind) {
    case 'portrait':
      return { tone: 'ok', title: TV_COPY.found.title, detail: TV_COPY.found.detail(size(guest.display)), action: 'open' }
    case 'landscape-external':
      return { tone: 'warning', ...TV_COPY.landscape, action: 'open-landscape' }
    case 'missing':
      return { tone: 'danger', ...TV_COPY.missing, action: 'none' }
  }
}

const DOT = { ok: 'bg-ok', warning: 'bg-danger', danger: 'bg-danger', neutral: 'bg-ink-soft/40' } as const

/**
 * Laptop: the TV monitor and the camera window on it. Until the create-event form exists (RF01),
 * this card is how the operator opens and closes the TV; `Iniciar evento` will take over opening.
 */
export function TvCard() {
  const [view, setDisplayState] = useDisplayState()
  const [pending, setPending] = useState(false)
  const [failed, setFailed] = useState(false)
  const line = describeTv(view)

  const run = async (request: () => Promise<DisplayState>) => {
    setPending(true)
    setFailed(false)
    try {
      setDisplayState(await request())
    } catch {
      setFailed(true)
    } finally {
      setPending(false)
    }
  }
  const open = (allowLandscape: boolean) => run(async () => (await window.fotomagica.tv.open({ allowLandscape })).state)
  const close = () => run(() => window.fotomagica.tv.close())

  return (
    <section aria-labelledby="tv-card-title" data-testid="tv-card" className="w-full rounded-[var(--radius-card)] border border-line bg-bg-raised p-8">
      <h2 id="tv-card-title" className="text-lg font-semibold text-ink">
        {TV_COPY.heading}
      </h2>
      <div role="status" aria-live="polite" data-testid="tv-status" className="mt-4 flex items-start gap-3">
        <span aria-hidden className={cn('mt-1.5 size-2.5 shrink-0 rounded-full', DOT[line.tone])} />
        <div>
          <p className={cn('font-medium', line.tone === 'danger' ? 'text-danger' : 'text-ink')}>{line.title}</p>
          <p className="text-sm text-ink-soft tabular-nums">{line.detail}</p>
        </div>
      </div>
      {failed ? (
        <p role="alert" className="mt-3 text-sm text-danger">
          {TV_COPY.actionError}
        </p>
      ) : null}
      <div className="mt-6 border-t border-line pt-6">
        <CameraStatusLine />
      </div>
      <div className="mt-8 flex justify-end">
        {line.action === 'close' ? (
          <Button variant="ghost" disabled={pending} onClick={() => void close()}>
            {TV_COPY.close}
          </Button>
        ) : line.action === 'open-landscape' ? (
          <Button disabled={pending} onClick={() => void open(true)}>
            {TV_COPY.openAnyway}
          </Button>
        ) : (
          <Button disabled={pending || line.action !== 'open'} onClick={() => void open(false)}>
            {TV_COPY.open.action}
          </Button>
        )}
      </div>
    </section>
  )
}
