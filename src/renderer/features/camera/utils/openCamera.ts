import { cameraConstraints, selectCamera, videoInputs } from '@shared/capture'

export type MediaDevicesLike = Pick<MediaDevices, 'enumerateDevices' | 'getUserMedia'>

export type OpenedCamera = {
  stream: MediaStream
  track: MediaStreamTrack
  label: string
  width: number
  height: number
}

function stopStream(stream: MediaStream): void {
  for (const track of stream.getTracks()) track.stop()
}

async function requestStream(media: MediaDevicesLike, deviceId: string | null): Promise<MediaStream> {
  try {
    return await media.getUserMedia(cameraConstraints(deviceId))
  } catch (error) {
    // The chosen device vanished between listing and opening: take whatever camera is there.
    const name = error instanceof DOMException ? error.name : ''
    if (deviceId && (name === 'OverconstrainedError' || name === 'NotFoundError')) {
      return media.getUserMedia(cameraConstraints(null))
    }
    throw error
  }
}

/**
 * Opens the camera as DESIGN §5 says: the device labelled `MX Brio`, else the first camera,
 * asking for 1920×1080 at 30 fps as ideals, so whatever mode the camera delivers is accepted.
 * Before camera permission exists, labels are empty; then the list is read again after opening
 * and the Brio, if it shows up, replaces the camera opened blind.
 * Rejects with the `getUserMedia` error, or a `NotFoundError` when there is no camera at all.
 */
export async function openCamera(media: MediaDevicesLike): Promise<OpenedCamera> {
  const devices = await media.enumerateDevices()
  const cameras = videoInputs(devices)
  if (cameras.length === 0) throw new DOMException('No camera connected', 'NotFoundError')

  let stream = await requestStream(media, selectCamera(devices)?.deviceId || null)

  if (cameras.every((camera) => camera.label === '')) {
    const preferred = selectCamera(await media.enumerateDevices())
    const openedId = stream.getVideoTracks()[0]?.getSettings().deviceId
    if (preferred?.deviceId && preferred.deviceId !== openedId) {
      stopStream(stream)
      stream = await requestStream(media, preferred.deviceId)
    }
  }

  const track = stream.getVideoTracks()[0]
  if (!track) {
    stopStream(stream)
    throw new DOMException('The camera delivered no video track', 'NotReadableError')
  }
  const settings = track.getSettings()
  return {
    stream,
    track,
    label: track.label,
    width: settings.width ?? 0,
    height: settings.height ?? 0,
  }
}
