import { useState } from 'react'
import { WEBCAM_COPY, WebcamPanel } from '@renderer/features/webcam'
import { cn } from '@renderer/shared/utils/cn'
import { BAR } from '@renderer/shared/utils/glass'

const TARGET =
  'flex min-h-16 min-w-16 cursor-pointer items-center justify-center rounded-full px-6 text-3xl font-semibold text-white focus-visible:outline-4 focus-visible:outline-offset-4 focus-visible:outline-white'

/** Sun with rays, the adjustments icon, drawn in white line like the iPhone's top icons. */
function AdjustIcon() {
  return (
    <svg aria-hidden viewBox="0 0 24 24" className="size-14" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round">
      <circle cx="12" cy="12" r="4" />
      {[0, 45, 90, 135, 180, 225, 270, 315].map((angle) => (
        <line key={angle} x1="12" y1="2.5" x2="12" y2="5" transform={`rotate(${angle} 12 12)`} />
      ))}
    </svg>
  )
}

/**
 * The TV top bar (PRD §6.4, DESIGN §14): a dark translucent strip with the webcam adjustments icon
 * centered where the iPhone has the flash. No grid toggle and no flip-camera icon. The panel floats
 * on strong glass under the bar.
 */
export function TvTopBar() {
  const [adjusting, setAdjusting] = useState(false)
  return (
    <>
      <div data-testid="tv-top-bar" className={cn('absolute inset-x-0 top-0 flex h-40 items-center justify-center', BAR)}>
        <button
          type="button"
          aria-label={WEBCAM_COPY.open}
          aria-expanded={adjusting}
          onClick={() => setAdjusting((open) => !open)}
          className={cn(TARGET, 'size-24 px-0 active:bg-white/25', adjusting && 'bg-white text-ink')}
        >
          <AdjustIcon />
        </button>
      </div>
      {adjusting ? (
        <div role="dialog" aria-label={WEBCAM_COPY.title} className="absolute inset-x-12 top-48 z-30 flex max-h-[1300px] flex-col gap-8 overflow-y-auto rounded-[40px] bg-glass-strong p-12 backdrop-blur-[24px]">
          <div className="flex items-center justify-between">
            <p className="text-4xl font-semibold text-white">{WEBCAM_COPY.title}</p>
            <button type="button" onClick={() => setAdjusting(false)} className={cn(TARGET, 'bg-white/15')}>
              {WEBCAM_COPY.close}
            </button>
          </div>
          <WebcamPanel surface="tv" />
        </div>
      ) : null}
    </>
  )
}
