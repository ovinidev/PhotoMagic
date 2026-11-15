import { useEffect, useState } from 'react'
import type { CameraStatus } from '@shared/ipc'

export type CameraStatusState = { status: 'loading' } | { status: 'ready'; value: CameraStatus } | { status: 'error' }

/** Laptop side: the TV camera state relayed by main, kept current by `camera:status` events. */
export function useCameraStatus(): CameraStatusState {
  const [state, setState] = useState<CameraStatusState>({ status: 'loading' })

  useEffect(() => {
    let active = true
    let pushed = false
    const unsubscribe = window.fotomagica.camera.onStatus((value) => {
      pushed = true
      if (active) setState({ status: 'ready', value })
    })
    window.fotomagica.camera
      .getStatus()
      // An event that arrived first is newer than this answer.
      .then((value) => active && !pushed && setState({ status: 'ready', value }))
      .catch(() => active && !pushed && setState({ status: 'error' }))
    return () => {
      active = false
      unsubscribe()
    }
  }, [])

  return state
}
