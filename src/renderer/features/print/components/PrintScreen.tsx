import { useMemo, useState, type ReactNode } from 'react'
import markUrl from '@brand/mark.png'
import { COPIES } from '@shared/constants'
import type { EventSession, SessionState } from '@shared/ipc'
import { stepCopies } from '@shared/round'
import { useMontagePreview } from '@renderer/shared/hooks/useMontagePreview'
import { cn } from '@renderer/shared/utils/cn'
import { GLASS } from '@renderer/shared/utils/glass'
import { PRINT_COPY, copiesLabel } from '../copy'
import { usePrinterStatus } from '../hooks/usePrinterStatus'
import { revealBoxes } from '../utils/reveal'
import { MontageReveal } from './MontageReveal'

function TvAction({ label, icon, onClick, disabled, primary }: { label: string; icon: ReactNode; onClick: () => void; disabled?: boolean; primary?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="flex min-h-16 min-w-16 cursor-pointer flex-col items-center gap-3 text-2xl font-semibold text-white disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline-4 focus-visible:outline-offset-4 focus-visible:outline-white"
    >
      <span aria-hidden className={cn('flex size-28 items-center justify-center rounded-full text-6xl leading-none', primary ? 'bg-white text-ink' : GLASS)}>
        {icon}
      </span>
      {label}
    </button>
  )
}

/**
 * The TV print screen (PRD §6.5, DESIGN §14, figure 9): over the darkened camera, `Imprimir` and
 * `Cancelar` on one side, `Mais` and `Menos` on the other, the copies in the middle and the sheet
 * preview below. After a print, `Imprimir novamente` and `Nova rodada`; a failure keeps the round
 * and offers to try again. A printer that is not ready shows its state before anyone taps
 * `Imprimir`. Every action is an invoke; main owns the round.
 */
export function PrintScreen({ session }: { session: EventSession }) {
  const preview = useMontagePreview(session.previewRevision)
  const printer = usePrinterStatus()
  const { phase, copies } = session
  const run = (action: () => Promise<SessionState>) => void action().catch(() => {})
  const api = window.fotomagica.session
  const busy = phase.kind === 'printing'
  const setCopies = (delta: 1 | -1) => run(() => api.setCopies(stepCopies(copies, delta)))
  // The montage reveal plays once, when the round first reaches review and its preview has loaded.
  const [reveal] = useState(() => phase.kind === 'review')
  const [loaded, setLoaded] = useState(false)
  const revealed = useMemo(() => revealBoxes(session.mode, session.slots, session.boxes), [session.mode, session.slots, session.boxes])

  return (
    <div data-testid="print-screen" data-phase={phase.kind} className="absolute inset-0 flex flex-col items-center justify-center gap-16 bg-black/65 px-16">
      {/* The symbol only, outside the sheet preview, at most 48 px (DESIGN §14). */}
      <img src={markUrl} alt="" aria-hidden data-testid="print-mark" className="absolute top-12 right-12 size-12 invert" draggable={false} />
      <div className="grid w-full grid-cols-[1fr_auto_1fr] items-center gap-10">
        <div className="flex justify-start gap-10">
          {phase.kind === 'printed' ? (
            <>
              <TvAction label={PRINT_COPY.again} icon="⎙" primary onClick={() => run(api.reprint)} />
              <TvAction label={PRINT_COPY.newRound} icon="↺" onClick={() => run(api.newRound)} />
            </>
          ) : (
            <>
              <TvAction label={phase.kind === 'print-failed' ? PRINT_COPY.retry : PRINT_COPY.print} icon="⎙" primary disabled={busy} onClick={() => run(api.print)} />
              <TvAction label={PRINT_COPY.cancel} icon="✕" disabled={busy} onClick={() => run(api.cancel)} />
            </>
          )}
        </div>
        <p data-testid="copies" className="text-center text-5xl font-semibold whitespace-nowrap text-white tabular-nums">
          {copiesLabel(copies)}
        </p>
        <div className="flex justify-end gap-10">
          <TvAction label={PRINT_COPY.more} icon="+" disabled={busy || copies >= COPIES.max} onClick={() => setCopies(1)} />
          <TvAction label={PRINT_COPY.less} icon="−" disabled={busy || copies <= COPIES.min} onClick={() => setCopies(-1)} />
        </div>
      </div>

      <div className="relative flex aspect-[1844/1240] w-full items-center justify-center overflow-hidden rounded-[24px] bg-white/10 shadow-2xl">
        {preview.status === 'ready' && preview.url ? (
          <img src={preview.url} alt={PRINT_COPY.previewAlt} data-testid="print-preview" className={cn('h-full w-full object-contain', reveal && !loaded && 'opacity-0')} draggable={false} onLoad={() => setLoaded(true)} />
        ) : (
          <p className="text-3xl text-white/80">{preview.status === 'error' ? PRINT_COPY.previewError : PRINT_COPY.previewLoading}</p>
        )}
        {reveal && loaded && preview.status === 'ready' && preview.url ? <MontageReveal url={preview.url} boxes={revealed} /> : null}
      </div>

      <div role="status" aria-live="polite" className="min-h-24 text-center text-white">
        {printer && printer.kind !== 'ready' && (phase.kind === 'review' || phase.kind === 'printed') ? (
          <p data-testid="tv-printer-status" className="text-3xl font-semibold text-white/90">
            {PRINT_COPY.status[printer.kind]}
          </p>
        ) : null}
        {phase.kind === 'printing' ? <p className="text-4xl font-semibold">{PRINT_COPY.printing}</p> : null}
        {phase.kind === 'printed' ? <p className="text-4xl font-semibold">{PRINT_COPY.printed}</p> : null}
        {phase.kind === 'print-failed' ? (
          <>
            <p className="text-4xl font-semibold">{PRINT_COPY.failures[phase.reason]}</p>
            {phase.fileName ? <p className="mt-3 text-2xl text-white/80">{PRINT_COPY.savedKept(phase.fileName)}</p> : null}
          </>
        ) : null}
      </div>
    </div>
  )
}
