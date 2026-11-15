import { useEffect, useState } from 'react'
import type { DisplayState } from '@shared/ipc'

export type DisplayStateView = { status: 'loading' } | { status: 'ready'; value: DisplayState } | { status: 'error' }

/** Laptop side: the TV monitor choice and the TV window state, kept current by `display:state` events. */
export function useDisplayState(): [DisplayStateView, (value: DisplayState) => void] {
  const [state, setState] = useState<DisplayStateView>({ status: 'loading' })

  useEffect(() => {
    let active = true
    let pushed = false
    const unsubscribe = window.fotomagica.display.onState((value) => {
      pushed = true
      if (active) setState({ status: 'ready', value })
    })
    window.fotomagica.display
      .getState()
      // An event that arrived first is newer than this answer.
      .then((value) => active && !pushed && setState({ status: 'ready', value }))
      .catch(() => active && !pushed && setState({ status: 'error' }))
    return () => {
      active = false
      unsubscribe()
    }
  }, [])

  return [state, (value) => setState({ status: 'ready', value })]
}
