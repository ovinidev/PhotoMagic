import type { EventSession, Timer } from '@shared/ipc'
import { PHOTOS_PER_ROUND } from '@shared/layout'
import { TIMER_OPTIONS } from '@shared/round'
import { TvGallery } from '@renderer/features/gallery'
import { cn } from '@renderer/shared/utils/cn'
import { CAPTURE_COPY } from '../copy'
import type { ShutterState } from '../hooks/useShutter'
import { BAR, GLASS } from '@renderer/shared/utils/glass'

/**
 * TV capture chrome over the live image (DESIGN §14), in the iPhone camera look: the countdown in the
 * middle, and a dark translucent bottom bar with the `1/3` counter pill above a 240 px white shutter
 * in a ring, the gallery thumbnail to its left and the timer (off, 5 s, 10 s) to its right. The
 * shutter shrinks and dims while pressed. Every target is at least 64 px.
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
        <p role="alert" className={cn('absolute inset-x-16 top-48 rounded-[32px] px-10 py-6 text-center text-3xl text-white', GLASS)}>
          {CAPTURE_COPY.captureError}
        </p>
      ) : null}

      <div data-testid="tv-bottom-bar" className={cn('absolute inset-x-0 bottom-0 flex flex-col items-center gap-8 pt-8 pb-16', BAR)}>
        <p data-testid="photo-counter" className="rounded-full bg-black/40 px-8 py-2 text-5xl font-semibold text-white tabular-nums">
          {CAPTURE_COPY.counter(current, PHOTOS_PER_ROUND)}
        </p>
        <div className="grid w-full grid-cols-[1fr_auto_1fr] items-center px-12">
          <div className="flex justify-start">
            <TvGallery />
          </div>
          <button
            type="button"
            aria-label={CAPTURE_COPY.shutter}
            disabled={disabled || shutter.busy}
            onClick={shutter.trigger}
            className="group flex size-60 cursor-pointer items-center justify-center rounded-full border-[10px] border-white disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-4 focus-visible:outline-offset-8 focus-visible:outline-white"
          >
            <span className="size-48 rounded-full bg-shutter shadow-[0_4px_24px_rgba(0,0,0,0.35)] group-active:scale-[0.86] group-active:bg-white/75 group-disabled:scale-100" />
          </button>
          <div role="radiogroup" aria-label={CAPTURE_COPY.timer} className="flex justify-self-end gap-1 rounded-full bg-black/40 p-2">
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
                  'min-h-16 min-w-16 cursor-pointer rounded-full px-4 text-3xl font-semibold tabular-nums disabled:cursor-not-allowed',
                  session.timer === option ? 'bg-white/20 text-timer' : 'text-white',
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
