import { useEffect, useState } from 'react'
import type { WebcamState } from '@shared/ipc'

export type WebcamStateView = { status: 'loading' } | { status: 'ready'; value: WebcamState } | { status: 'error' }

/** The webcam adjustments as main has them, kept current by `webcam:state` (both windows). */
export function useWebcamState(): WebcamStateView {
  const [view, setView] = useState<WebcamStateView>({ status: 'loading' })
  useEffect(() => {
    let active = true
    let pushed = false
    const unsubscribe = window.fotomagica.webcam.onState((value) => {
      pushed = true
      if (active) setView({ status: 'ready', value })
    })
    window.fotomagica.webcam
      .getState()
      .then((value) => active && !pushed && setView({ status: 'ready', value }))
      .catch(() => active && !pushed && setView({ status: 'error' }))
    return () => {
      active = false
      unsubscribe()
    }
  }, [])
  return view
}
