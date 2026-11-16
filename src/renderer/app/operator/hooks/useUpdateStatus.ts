import { useEffect, useState } from 'react'
import type { UpdateStatus } from '@shared/ipc'

/** The background auto-update (DESIGN §11), kept current by `update:status`. Idle until main answers. */
export function useUpdateStatus(): UpdateStatus {
  const [status, setStatus] = useState<UpdateStatus>({ kind: 'idle' })

  useEffect(() => {
    let active = true
    let pushed = false
    const unsubscribe = window.fotomagica.update.onStatus((value) => {
      pushed = true
      if (active) setStatus(value)
    })
    window.fotomagica.update
      .getStatus()
      // An event that arrived first is newer than this answer; a failed read just shows nothing.
      .then((value) => active && !pushed && setStatus(value))
      .catch(() => {})
    return () => {
      active = false
      unsubscribe()
    }
  }, [])

  return status
}
