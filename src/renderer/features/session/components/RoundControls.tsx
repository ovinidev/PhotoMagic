import { useId } from 'react'
import { COPIES } from '@shared/constants'
import type { EventSession, SessionState, Timer } from '@shared/ipc'
import { PHOTOS_PER_ROUND } from '@shared/layout'
import { TIMER_OPTIONS, stepCopies } from '@shared/round'
import { PRINT_COPY, copiesLabel } from '@renderer/features/print'
import { Button } from '@renderer/shared/components/ui/button'
import { SESSION_COPY } from '../copy'

function phaseLine(session: EventSession): { text: string; danger: boolean } {
  const { phase } = session
  switch (phase.kind) {
    case 'capturing':
      return { text: SESSION_COPY.photo(session.taken + 1, PHOTOS_PER_ROUND), danger: false }
    case 'review':
      return { text: SESSION_COPY.review, danger: false }
    case 'printing':
      return { text: SESSION_COPY.printing, danger: false }
    case 'printed':
      return { text: SESSION_COPY.printed(phase.fileName), danger: false }
    case 'print-failed':
      return { text: PRINT_COPY.failures[phase.reason], danger: true }
  }
}

/**
 * Laptop round controls (PRD §6.3): the shutter, which asks the TV to run its own capture (timer
 * included), the timer shared with the TV (RF07), the copies (RF10) and where the round is.
 */
export function RoundControls({ session }: { session: EventSession }) {
  const timerId = useId()
  const api = window.fotomagica.session
  const run = (action: () => Promise<SessionState>) => void action().catch(() => {})
  const line = phaseLine(session)
  const capturing = session.phase.kind === 'capturing'
  const busy = session.phase.kind === 'printing'

  return (
    <div className="flex flex-col gap-6">
      <div role="status" aria-live="polite">
        <p data-testid="round-status" className={line.danger ? 'font-medium text-danger' : 'font-medium text-ink tabular-nums'}>
          {line.text}
        </p>
        {session.phase.kind === 'print-failed' && session.phase.detail ? (
          <p data-testid="round-status-detail" className="mt-1 text-sm text-ink-soft">
            {PRINT_COPY.technicalDetail(session.phase.detail)}
          </p>
        ) : null}
      </div>
      <div className="flex flex-wrap items-end gap-4">
        <Button disabled={!capturing} onClick={() => api.requestShutter()}>
          {SESSION_COPY.shutter}
        </Button>
        <div className="flex flex-col gap-1">
          <label htmlFor={timerId} className="text-xs font-medium text-ink-soft">
            {SESSION_COPY.timer}
          </label>
          <select
            id={timerId}
            value={session.timer}
            onChange={(event) => run(() => api.setTimer(Number(event.target.value) as Timer))}
            className="min-h-11 cursor-pointer rounded-[var(--radius-field)] border border-line bg-bg-raised px-3 text-sm text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
          >
            {TIMER_OPTIONS.map((option) => (
              <option key={option} value={option}>
                {SESSION_COPY.timerOptions[option]}
              </option>
            ))}
          </select>
        </div>
      </div>
      <div className="flex flex-col gap-1">
        <span className="text-xs font-medium text-ink-soft">{SESSION_COPY.copies}</span>
        <div className="flex items-center gap-3">
          <Button variant="ghost" disabled={busy || session.copies <= COPIES.min} onClick={() => run(() => api.setCopies(stepCopies(session.copies, -1)))}>
            {PRINT_COPY.less}
          </Button>
          <span data-testid="laptop-copies" className="min-w-24 text-center font-medium text-ink tabular-nums">
            {copiesLabel(session.copies)}
          </span>
          <Button variant="ghost" disabled={busy || session.copies >= COPIES.max} onClick={() => run(() => api.setCopies(stepCopies(session.copies, 1)))}>
            {PRINT_COPY.more}
          </Button>
        </div>
      </div>
    </div>
  )
}
