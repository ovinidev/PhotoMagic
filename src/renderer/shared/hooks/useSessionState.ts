import { useEffect, useState } from 'react'
import type { SessionState } from '@shared/ipc'

export type SessionStateView = { status: 'loading' } | { status: 'ready'; value: SessionState } | { status: 'error' }

/**
 * The event and its round as main sees it (main is the source of truth, DESIGN §2), kept current by
 * `session:state`. Both windows use it. `set` applies the state an invoke just returned.
 */
export function useSessionState(): [SessionStateView, (value: SessionState) => void] {
  const [state, setState] = useState<SessionStateView>({ status: 'loading' })

  useEffect(() => {
    let active = true
    let pushed = false
    const unsubscribe = window.fotomagica.session.onState((value) => {
      pushed = true
      if (active) setState({ status: 'ready', value })
    })
    window.fotomagica.session
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
