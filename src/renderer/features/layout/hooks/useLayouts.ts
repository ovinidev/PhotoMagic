import { useEffect, useState } from 'react'
import type { Layouts } from '@shared/layout'

export type LayoutsView = { status: 'loading' } | { status: 'ready'; value: Layouts } | { status: 'error' }

/** Both saved layouts (or the PRD seeds on first run), read once when the editor opens. */
export function useLayouts(): LayoutsView {
  const [view, setView] = useState<LayoutsView>({ status: 'loading' })
  useEffect(() => {
    let active = true
    window.fotomagica.layout
      .get()
      .then((value) => active && setView({ status: 'ready', value }))
      .catch(() => active && setView({ status: 'error' }))
    return () => {
      active = false
    }
  }, [])
  return view
}
