import { useCallback, useEffect, useState } from 'react'
import type { CameraErrorReason, CameraStatus } from '@shared/ipc'
import { classifyCameraError } from '../utils/cameraErrors'
import { openCamera, type MediaDevicesLike } from '../utils/openCamera'

export type CameraState =
  | { kind: 'starting' }
  | { kind: 'live'; stream: MediaStream; label: string; width: number; height: number }
  | { kind: 'error'; reason: CameraErrorReason }

export function toCameraStatus(state: CameraState): CameraStatus {
  if (state.kind === 'live') {
    return { kind: 'live', label: state.label.slice(0, 256), width: state.width, height: state.height }
  }
  return state
}

/**
 * The TV's camera (DESIGN §4: the TV is the sole owner of the `MediaStream`). Opens once on mount,
 * reports every state change to main, turns an unplugged camera into `disconnected`, and reopens on
 * its own when a device is plugged in while in error, so a dropped webcam comes back without a tap.
 */
export function useCamera(media: MediaDevicesLike & EventTarget = navigator.mediaDevices): {
  state: CameraState
  retry: () => void
} {
  const [state, setState] = useState<CameraState>({ kind: 'starting' })
  const [attempt, setAttempt] = useState(0)

  const retry = useCallback(() => {
    setState({ kind: 'starting' })
    setAttempt((value) => value + 1)
  }, [])

  useEffect(() => {
    let active = true
    let opened: MediaStream | null = null
    const onEnded = () => active && setState({ kind: 'error', reason: 'disconnected' })

    openCamera(media)
      .then((camera) => {
        opened = camera.stream
        if (!active) {
          for (const track of camera.stream.getTracks()) track.stop()
          return
        }
        camera.track.addEventListener('ended', onEnded)
        setState({ kind: 'live', stream: camera.stream, label: camera.label, width: camera.width, height: camera.height })
      })
      .catch((error: unknown) => {
        if (active) setState({ kind: 'error', reason: classifyCameraError(error) })
      })

    return () => {
      active = false
      if (opened) {
        for (const track of opened.getTracks()) {
          track.removeEventListener('ended', onEnded)
          track.stop()
        }
      }
    }
  }, [media, attempt])

  // Only while in error: a device plugged in (or the webcam coming back) reopens without a tap.
  const inError = state.kind === 'error'
  useEffect(() => {
    if (!inError) return
    media.addEventListener('devicechange', retry)
    return () => media.removeEventListener('devicechange', retry)
  }, [media, retry, inError])

  useEffect(() => {
    window.fotomagica.camera.report(toCameraStatus(state))
  }, [state])

  return { state, retry }
}
