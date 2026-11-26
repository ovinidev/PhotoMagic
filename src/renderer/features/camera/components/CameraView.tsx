import { useMemo, useRef, type ReactNode } from 'react'
import { useApplyWebcam } from '@renderer/features/webcam'
import type { EventSession } from '@shared/ipc'
import { CAMERA_COPY } from '../copy'
import { useCamera } from '../hooks/useCamera'
import { useShutter } from '../hooks/useShutter'
import { CameraPreview } from './CameraPreview'
import { CaptureControls } from './CaptureControls'
import { TvTopBar } from './TvTopBar'
import { GLASS } from '@renderer/shared/utils/glass'

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
 * With an event capturing, the shutter, counter and timer float over it. The camera stays open
 * during the print screen, so the next round starts at once.
 */
export function CameraView({ session = null }: { session?: EventSession | null }) {
  const { state, retry } = useCamera()
  const videoRef = useRef<HTMLVideoElement>(null)
  const shutter = useShutter({ session, videoRef })
  const stream = state.kind === 'live' ? state.stream : null
  const track = useMemo(() => stream?.getVideoTracks()[0] ?? null, [stream])
  useApplyWebcam(track)
  const capturing = session !== null && session.phase.kind === 'capturing'

  return (
    <div className="relative h-full w-full overflow-hidden bg-black" data-testid="camera-view" data-camera-state={state.kind}>
      {state.kind === 'live' ? <CameraPreview stream={state.stream} videoRef={videoRef} /> : null}
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
      {session ? <TvTopBar /> : null}
      {capturing ? <CaptureControls session={session} shutter={shutter} disabled={state.kind !== 'live'} /> : null}
    </div>
  )
}
