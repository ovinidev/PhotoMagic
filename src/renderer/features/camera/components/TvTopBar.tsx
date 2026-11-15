import { useState } from 'react'
import { WEBCAM_COPY, WebcamPanel } from '@renderer/features/webcam'
import { cn } from '@renderer/shared/utils/cn'
import { GLASS } from '@renderer/shared/utils/glass'
import { CAPTURE_COPY } from '../copy'

const TARGET =
  'flex min-h-16 min-w-16 cursor-pointer items-center justify-center rounded-full px-6 text-2xl font-semibold text-white focus-visible:outline-4 focus-visible:outline-offset-4 focus-visible:outline-white'

/**
 * The TV top glass bar (PRD §6.4, DESIGN §14): the webcam adjustments icon where the iPhone has the
 * flash, and the rule-of-thirds grid toggle. No flip-camera icon. The panel floats on strong glass.
 */
export function TvTopBar({ grid, onToggleGrid }: { grid: boolean; onToggleGrid: () => void }) {
  const [adjusting, setAdjusting] = useState(false)
  return (
    <>
      <div className={cn('absolute inset-x-0 top-0 flex items-center justify-between px-12 py-6', GLASS)}>
        <button type="button" aria-label={WEBCAM_COPY.open} aria-expanded={adjusting} onClick={() => setAdjusting((open) => !open)} className={TARGET}>
          <span aria-hidden className="text-4xl leading-none">
            ☼
          </span>
        </button>
        <button type="button" aria-label={CAPTURE_COPY.grid} aria-pressed={grid} onClick={onToggleGrid} className={cn(TARGET, grid && 'bg-white text-ink')}>
          <span aria-hidden className="text-4xl leading-none">
            #
          </span>
        </button>
      </div>
      {adjusting ? (
        <div role="dialog" aria-label={WEBCAM_COPY.title} className="absolute inset-x-12 top-36 z-30 flex max-h-[1300px] flex-col gap-8 overflow-y-auto rounded-[40px] bg-glass-strong p-12 backdrop-blur-[24px]">
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

/** Rule-of-thirds grid: white hairlines at 20% opacity; off means gone (DESIGN §14). */
export function ThirdsGrid() {
  return (
    <div aria-hidden data-testid="thirds-grid" className="pointer-events-none absolute inset-0">
      {[1, 2].map((third) => (
        <span key={`v${third}`} className="absolute inset-y-0 w-px bg-white/20" style={{ left: `${(third * 100) / 3}%` }} />
      ))}
      {[1, 2].map((third) => (
        <span key={`h${third}`} className="absolute inset-x-0 h-px bg-white/20" style={{ top: `${(third * 100) / 3}%` }} />
      ))}
    </div>
  )
}
