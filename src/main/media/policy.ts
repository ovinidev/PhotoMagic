import type { CameraFixture } from '@shared/runtime'

/**
 * Chromium permission policy (pure). Only the TV window may open the camera, video only:
 * the laptop gets frames from the TV, never from a second `getUserMedia`. Everything else is denied.
 */
export function allowPermission(request: {
  permission: string
  fromGuestWindow: boolean
  /** Present on media requests; empty or missing on permission checks. */
  mediaTypes?: readonly string[] | undefined
}): boolean {
  if (request.permission !== 'media' || !request.fromGuestWindow) return false
  const types = request.mediaTypes ?? []
  return types.every((type) => type === 'video')
}

/** Chromium switches that replace the webcam under E2E (DESIGN §12): never the real MX Brio. */
export function cameraFixtureSwitches(fixture: CameraFixture): Array<[name: string, value?: string]> {
  switch (fixture.kind) {
    case 'pattern':
      return [['use-fake-device-for-media-stream']]
    case 'none':
      return [['use-fake-device-for-media-stream', 'device-count=0']]
    case 'file':
      return [['use-fake-device-for-media-stream'], ['use-file-for-fake-video-capture', fixture.path]]
  }
}
