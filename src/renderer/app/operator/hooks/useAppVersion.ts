import { useEffect, useState } from 'react'
import type { AppVersion } from '@shared/ipc'

export type AppVersionState =
  | { status: 'loading' }
  | { status: 'ready'; value: AppVersion }
  | { status: 'error' }

/** Reads `app:get-version` once through the preload bridge. */
export function useAppVersion(): AppVersionState {
  const [state, setState] = useState<AppVersionState>({ status: 'loading' })

  useEffect(() => {
    let active = true
    window.fotomagica.app
      .getVersion()
      .then((value) => active && setState({ status: 'ready', value }))
      .catch(() => active && setState({ status: 'error' }))
    return () => {
      active = false
    }
  }, [])

  return state
}
