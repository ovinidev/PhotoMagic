import type { EventSession, Timer } from '@shared/ipc'
import { PHOTOS_PER_ROUND } from '@shared/layout'
import { TIMER_OPTIONS } from '@shared/round'
import { cn } from '@renderer/shared/utils/cn'
import { CAPTURE_COPY } from '../copy'
import type { ShutterState } from '../hooks/useShutter'
import { GLASS } from './glass'

/**
 * TV capture chrome over the live image (DESIGN §14): the countdown in the middle, the `1/3` counter
 * above the white button, and the timer (off, 5 s, 10 s) to its right, on a bottom glass bar.
 * Every target is at least 64 px; the shutter is 96 px inside its ring.
 */
export function CaptureControls({ session, shutter, disabled }: { session: EventSession; shutter: ShutterState; disabled: boolean }) {
  const current = Math.min(session.taken + 1, PHOTOS_PER_ROUND)
  const setTimer = (timer: Timer) => void window.fotomagica.session.setTimer(timer).catch(() => {})

  return (
    <>
      {shutter.countdown !== null ? (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <span data-testid="countdown" aria-live="assertive" className="text-[345px] leading-none font-semibold text-white tabular-nums drop-shadow-[0_4px_24px_rgba(0,0,0,0.5)]">
            {shutter.countdown}
          </span>
        </div>
      ) : null}
      {shutter.flashing ? <div aria-hidden className="pointer-events-none absolute inset-0 bg-white motion-reduce:hidden" /> : null}
      {shutter.failed ? (
        <p role="alert" className={cn('absolute inset-x-16 top-16 rounded-[32px] px-10 py-6 text-center text-3xl text-white', GLASS)}>
          {CAPTURE_COPY.captureError}
        </p>
      ) : null}

      <div className={cn('absolute inset-x-0 bottom-0 flex flex-col items-center gap-6 pt-6 pb-14', GLASS)}>
        <p data-testid="photo-counter" className="text-4xl font-semibold text-white tabular-nums">
          {CAPTURE_COPY.counter(current, PHOTOS_PER_ROUND)}
        </p>
        <div className="grid w-full grid-cols-[1fr_auto_1fr] items-center px-12">
          {/* Left: the gallery thumbnail lands here with the gallery (RF14). */}
          <span aria-hidden />
          <button
            type="button"
            aria-label={CAPTURE_COPY.shutter}
            disabled={disabled || shutter.busy}
            onClick={shutter.trigger}
            className="flex size-[124px] cursor-pointer items-center justify-center rounded-full border-[6px] border-white disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-4 focus-visible:outline-offset-4 focus-visible:outline-white"
          >
            <span className="size-24 rounded-full bg-shutter transition-transform active:scale-90 motion-reduce:transition-none" />
          </button>
          <div role="radiogroup" aria-label={CAPTURE_COPY.timer} className="flex justify-end gap-3">
            {TIMER_OPTIONS.map((option) => (
              <button
                key={option}
                type="button"
                role="radio"
                aria-checked={session.timer === option}
                aria-label={CAPTURE_COPY.timerOptions[option]}
                disabled={shutter.busy}
                onClick={() => setTimer(option)}
                className={cn(
                  'min-h-16 min-w-16 cursor-pointer rounded-full px-4 text-2xl font-semibold tabular-nums disabled:cursor-not-allowed',
                  session.timer === option ? 'bg-white text-ink' : 'text-white',
                )}
              >
                {CAPTURE_COPY.timerShort[option]}
              </button>
            ))}
          </div>
        </div>
      </div>
    </>
  )
}
