import type { CameraErrorReason } from '@shared/ipc'

const BY_NAME: Record<string, CameraErrorReason> = {
  NotAllowedError: 'permission-denied',
  SecurityError: 'permission-denied',
  PermissionDeniedError: 'permission-denied',
  NotFoundError: 'not-found',
  DevicesNotFoundError: 'not-found',
  OverconstrainedError: 'not-found',
  NotReadableError: 'in-use',
  TrackStartError: 'in-use',
  AbortError: 'in-use',
}

/** Maps a `getUserMedia` rejection (DOMException name, including legacy Chromium names) to a reason. */
export function classifyCameraError(error: unknown): CameraErrorReason {
  const name = typeof error === 'object' && error !== null && 'name' in error ? String(error.name) : ''
  return BY_NAME[name] ?? 'unknown'
}
