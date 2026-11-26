import { CAMERA_COPY } from '../copy'
import { useCameraStatus } from '../hooks/useCameraStatus'

/**
 * Laptop header, during an event: a red pill when the TV camera failed, next to `Encerrar evento`,
 * so the operator sees it without scrolling to the camera line. Nothing otherwise.
 */
export function CameraAlert() {
  const state = useCameraStatus()
  if (state.status !== 'ready' || state.value.kind !== 'error') return null
  return (
    <p role="alert" data-testid="header-camera-alert" className="max-w-64 truncate rounded-full bg-danger px-3 py-1 text-[13px] font-semibold text-white">
      {CAMERA_COPY.errors[state.value.reason].title}
    </p>
  )
}
