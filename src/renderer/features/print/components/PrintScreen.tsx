import type { ReactNode } from 'react'
import markUrl from '@brand/mark.png'
import { COPIES } from '@shared/constants'
import type { EventSession, SessionState } from '@shared/ipc'
import { stepCopies } from '@shared/round'
import { ShareQrPanel, useShareState } from '@renderer/features/share'
import { useMontagePreview } from '@renderer/shared/hooks/useMontagePreview'
import { cn } from '@renderer/shared/utils/cn'
import { BAR, GLASS } from '@renderer/shared/utils/glass'
import { PRINT_COPY, copiesLabel } from '../copy'
import { usePrinterStatus } from '../hooks/usePrinterStatus'
import { printProgress } from '../utils/printProgress'

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
 * The TV print screen (PRD §6.5, DESIGN §14, figure 9). The operator runs the TV; the guests watch
 * from a distance. Over the darkened camera: a printer warning on top when there is one, the sheet
 * preview (or, while a job runs, only the line for the step main reports, with no animation) and the
 * download QR codes. Every action sits in one bottom bar that never moves between phases, where the
 * shutter was: `Menos`, the copies and `Mais`, then the main action and the secondary one. Before a
 * print `Imprimir` leads; after it `Nova rodada` leads and `Imprimir novamente` is secondary; a
 * failure keeps the round and leads with `Tentar novamente`. Every action is an invoke; main owns the
 * round.
 */
export function PrintScreen({ session }: { session: EventSession }) {
  const preview = useMontagePreview(session.previewRevision)
  const printer = usePrinterStatus()
  const [share] = useShareState()
  const { phase, copies } = session
  const run = (action: () => Promise<SessionState>) => void action().catch(() => {})
  const api = window.fotomagica.session
  const busy = phase.kind === 'printing'
  const setCopies = (delta: 1 | -1) => run(() => api.setCopies(stepCopies(copies, delta)))
  const progress = printProgress(phase)
  const printerWarning = printer && printer.kind !== 'ready' && (phase.kind === 'review' || phase.kind === 'printed') ? PRINT_COPY.status[printer.kind] : null

  return (
    <div data-testid="print-screen" data-phase={phase.kind} className="absolute inset-0 flex flex-col bg-black/65">
      {/* The symbol only, outside the sheet preview, at most 48 px (DESIGN §14). */}
      <img src={markUrl} alt="" aria-hidden data-testid="print-mark" className="absolute top-12 right-12 size-12 invert" draggable={false} />

      <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-8 px-16 pt-28 pb-6">
        <div role="status" aria-live="polite" className="w-full empty:hidden">
          {phase.kind === 'print-failed' ? (
            <div data-testid="tv-print-alert" className="rounded-[32px] bg-warning px-10 py-8 text-center text-ink">
              <p className="flex items-center justify-center gap-4 text-5xl font-semibold">
                <span aria-hidden>⚠</span>
                <span>{PRINT_COPY.failures[phase.reason]}</span>
              </p>
              {phase.fileName ? <p className="mt-4 text-3xl">{PRINT_COPY.savedKept}</p> : null}
            </div>
          ) : printerWarning ? (
            <p data-testid="tv-printer-status" className="rounded-[32px] bg-warning px-10 py-6 text-center text-4xl font-semibold text-ink">
              {printerWarning}
            </p>
          ) : null}
        </div>

        {/* The sheet stays narrower than the screen so preview, animation and QR codes fit above the action bar. */}
        <div className="flex w-[78%] justify-center">
        {progress.kind === 'job' ? (
          <p
            data-testid="print-message"
            data-stage={progress.stage}
            role="status"
            aria-live="polite"
            className={cn('py-24 text-center font-semibold text-white', progress.stage === 'done' ? 'text-6xl' : 'text-5xl')}
          >
            {PRINT_COPY.stage[progress.stage]}
          </p>
        ) : (
          <div className="relative flex aspect-[1844/1240] w-full items-center justify-center overflow-hidden rounded-[24px] bg-white/10 shadow-2xl">
            {preview.status === 'ready' && preview.url ? (
              <img src={preview.url} alt={PRINT_COPY.previewAlt} data-testid="print-preview" className="h-full w-full object-contain" draggable={false} />
            ) : (
              <p className="text-3xl text-white/80">{preview.status === 'error' ? PRINT_COPY.previewError : PRINT_COPY.previewLoading}</p>
            )}
          </div>
        )}
        </div>

        {/* Offline photo download (DESIGN §17): shown once the montage is saved and the local server is up. */}
        <ShareQrPanel state={share} />
      </div>

      <div data-testid="print-actions" className={cn('flex flex-col items-center gap-6 px-12 pt-8 pb-12', BAR)}>
        <div className="flex items-center gap-12">
          <TvAction label={PRINT_COPY.less} icon="−" disabled={busy || copies <= COPIES.min} onClick={() => setCopies(-1)} />
          <p data-testid="copies" className="min-w-72 text-center text-5xl font-semibold whitespace-nowrap text-white tabular-nums">
            {copiesLabel(copies)}
          </p>
          <TvAction label={PRINT_COPY.more} icon="+" disabled={busy || copies >= COPIES.max} onClick={() => setCopies(1)} />
        </div>
        <div className="flex items-start justify-center gap-24">
          {phase.kind === 'printed' ? (
            <>
              <TvAction label={PRINT_COPY.newRound} icon="↺" primary onClick={() => run(api.newRound)} />
              <TvAction label={PRINT_COPY.again} icon="⎙" onClick={() => run(api.reprint)} />
            </>
          ) : (
            <>
              <TvAction label={phase.kind === 'print-failed' ? PRINT_COPY.retry : PRINT_COPY.print} icon="⎙" primary disabled={busy} onClick={() => run(api.print)} />
              <TvAction label={PRINT_COPY.cancel} icon="✕" disabled={busy} onClick={() => run(api.cancel)} />
            </>
          )}
        </div>
      </div>
    </div>
  )
}
