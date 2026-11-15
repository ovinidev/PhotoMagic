import type { ReactNode } from 'react'
import { CAMERA_COPY } from '../copy'
import { useCamera } from '../hooks/useCamera'
import { CameraPreview } from './CameraPreview'

/** Frosted glass over the image (DESIGN §14), with an opaque fallback when there is no blur. */
const GLASS =
  'bg-glass-strong backdrop-blur-[24px] supports-[not(backdrop-filter:blur(1px))]:bg-[rgba(28,28,30,0.72)]'

function CameraMessage({ title, detail, children }: { title: string; detail?: string; children?: ReactNode }) {
  return (
    <div className="absolute inset-0 flex items-center justify-center p-16">
      <div role="status" className={`flex max-w-[840px] flex-col items-center gap-6 rounded-[40px] px-14 py-12 text-center text-white ${GLASS}`}>
        <p className="text-5xl leading-tight font-semibold">{title}</p>
        {detail ? <p className="text-3xl leading-snug text-white/80">{detail}</p> : null}
        {children}
      </div>
    </div>
  )
}

/**
 * The TV camera surface, 1080×1920 logical: the live image fills the window edge to edge, already
 * rotated and mirrored, with no logo over it. Loading and error states float on glass, in pt-BR.
 */
export function CameraView() {
  const { state, retry } = useCamera()

  return (
    <div className="relative h-full w-full overflow-hidden bg-black" data-testid="camera-view" data-camera-state={state.kind}>
      {state.kind === 'live' ? <CameraPreview stream={state.stream} /> : null}
      {state.kind === 'starting' ? <CameraMessage title={CAMERA_COPY.starting} /> : null}
      {state.kind === 'error' ? (
        <CameraMessage {...CAMERA_COPY.errors[state.reason]}>
          <button
            type="button"
            onClick={retry}
            className="mt-2 min-h-16 min-w-16 cursor-pointer rounded-full bg-white px-10 text-3xl font-semibold text-ink focus-visible:outline-4 focus-visible:outline-offset-4 focus-visible:outline-white"
          >
            {CAMERA_COPY.retry}
          </button>
        </CameraMessage>
      ) : null}
    </div>
  )
}
