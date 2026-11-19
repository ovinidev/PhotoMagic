import { cn } from '@renderer/shared/utils/cn'
import { PRINT_COPY } from '../copy'
import type { PrintProgress } from '../utils/printProgress'

type Job = Extract<PrintProgress, { kind: 'job' }>

/**
 * The TV print animation (DESIGN §14, Print progress): the sheet comes out of a printer slot as main
 * reports the real job steps, a bar shows the stages reached, then `Sua foto está pronta!`. Position
 * and bar follow `progress` only; nothing advances on a timer. `.print-photo` and `.print-progress`
 * in `index.css` hold the motion, and drop it under `prefers-reduced-motion`.
 */
export function PrintJob({ progress, previewUrl }: { progress: Job; previewUrl: string | null }) {
  const percent = Math.round(progress.value * 100)
  return (
    <div data-testid="print-job" data-stage={progress.stage} className="flex w-full flex-col items-center gap-12">
      <div className="flex w-full flex-col items-center">
        {/* The printer: a dark body with the paper slot along its lower edge. */}
        <div aria-hidden className="relative z-10 h-32 w-full rounded-[32px] bg-gradient-to-b from-neutral-700 to-neutral-900 shadow-2xl ring-1 ring-white/10">
          <span className={cn('absolute top-8 right-10 size-4 rounded-full', progress.active ? 'print-led bg-emerald-400' : 'bg-emerald-400/80')} />
          <span className="absolute inset-x-12 bottom-7 h-3 rounded-full bg-black shadow-[inset_0_2px_4px_rgba(0,0,0,0.9)]" />
        </div>
        <div className="-mt-10 aspect-[1844/1240] w-[88%] overflow-hidden pt-0">
          <div data-testid="print-photo" data-eject={progress.eject} className="print-photo h-full w-full overflow-hidden rounded-b-[20px] bg-white shadow-2xl">
            {previewUrl ? <img src={previewUrl} alt={PRINT_COPY.previewAlt} className="h-full w-full object-contain" draggable={false} /> : null}
          </div>
        </div>
      </div>

      <div
        role="progressbar"
        aria-label={PRINT_COPY.progress}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={percent}
        data-testid="print-progress"
        className="h-5 w-[72%] overflow-hidden rounded-full bg-white/20"
      >
        <div className={cn('print-progress h-full rounded-full bg-white', progress.active && 'print-progress-active')} style={{ width: `${percent}%` }} />
      </div>

      <p data-testid="print-message" role="status" aria-live="polite" className={cn('text-center font-semibold text-white', progress.stage === 'done' ? 'text-6xl' : 'text-4xl')}>
        {PRINT_COPY.stage[progress.stage]}
      </p>
    </div>
  )
}
