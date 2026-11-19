import { useEffect, useState } from 'react'
import type { ShareState } from '@shared/ipc'

/** The local photo server and the round's link as main reports them (DESIGN §15); `null` until known. */
export function useShareState(): [ShareState | null, (state: ShareState) => void] {
  const [state, setState] = useState<ShareState | null>(null)
  useEffect(() => {
    let active = true
    let pushed = false
    const unsubscribe = window.fotomagica.share.onState((value) => {
      pushed = true
      if (active) setState(value)
    })
    window.fotomagica.share
      .getState()
      .then((value) => active && !pushed && setState(value))
      .catch(() => {})
    return () => {
      active = false
      unsubscribe()
    }
  }, [])
  return [state, setState]
}
