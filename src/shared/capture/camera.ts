/**
 * Camera device choice (DESIGN §5). Pure, over the fields of `MediaDeviceInfo` it needs.
 */

/** The MX Brio is matched by this text in the device label, case-insensitively. */
export const PREFERRED_CAMERA_LABEL = 'MX Brio'

export type CameraDevice = {
  deviceId: string
  kind: string
  label: string
}

/** Video inputs only, in the order the system reports them. */
export function videoInputs<D extends CameraDevice>(devices: readonly D[]): D[] {
  return devices.filter((device) => device.kind === 'videoinput')
}

/**
 * The device whose label contains `MX Brio`; without it, the first video input; without any, null.
 * Labels are empty until camera permission is granted, so the fallback also covers that case.
 */
export function selectCamera<D extends CameraDevice>(devices: readonly D[]): D | null {
  const cameras = videoInputs(devices)
  const needle = PREFERRED_CAMERA_LABEL.toLowerCase()
  return cameras.find((camera) => camera.label.toLowerCase().includes(needle)) ?? cameras[0] ?? null
}

/** `getUserMedia` constraints: ideal 3840×2160 at 30 fps, no audio. A smaller camera keeps its largest mode. */
export function cameraConstraints(deviceId: string | null): MediaStreamConstraintsLike {
  return {
    audio: false,
    video: {
      ...(deviceId ? { deviceId: { exact: deviceId } } : {}),
      width: { ideal: 3840 },
      height: { ideal: 2160 },
      frameRate: { ideal: 30 },
    },
  }
}

/** Structural subset of DOM `MediaStreamConstraints`, so this file needs no DOM lib. */
export type MediaStreamConstraintsLike = {
  audio: false
  video: {
    deviceId?: { exact: string }
    width: { ideal: number }
    height: { ideal: number }
    frameRate: { ideal: number }
  }
}
