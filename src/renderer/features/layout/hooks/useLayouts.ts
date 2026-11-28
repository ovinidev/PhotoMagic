import { useEffect, useState } from 'react'
import type { FixedBoxes } from '@shared/ipc'
import type { Layouts } from '@shared/layout'

export type EditorData = { layouts: Layouts; boxes: FixedBoxes }
export type LayoutsView = { status: 'loading' } | { status: 'ready'; value: EditorData } | { status: 'error' }

/** Both saved layouts (or the PRD seeds on first run) and each mode's fixed boxes, read once when the editor opens. */
export function useLayouts(): LayoutsView {
  const [view, setView] = useState<LayoutsView>({ status: 'loading' })
  useEffect(() => {
    let active = true
    Promise.all([window.fotomagica.layout.get(), window.fotomagica.layout.getBoxes()])
      .then(([layouts, boxes]) => active && setView({ status: 'ready', value: { layouts, boxes } }))
      .catch(() => active && setView({ status: 'error' }))
    return () => {
      active = false
    }
  }, [])
  return view
}
