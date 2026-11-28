import { useEffect, useState } from 'react'
import type { FixedBoxes } from '@shared/ipc'

/**
 * Each mode's fixed boxes in use (DESIGN §6), for the create-event preview. Read again whenever
 * `revision` changes: the home page bumps it when the editor closes, and a new template counts too.
 * `null` until read, or when the read fails (the preview then shows the standard boxes).
 */
export function useFixedBoxes(revision: unknown): FixedBoxes | null {
  const [boxes, setBoxes] = useState<FixedBoxes | null>(null)
  useEffect(() => {
    let active = true
    window.fotomagica.layout
      .getBoxes()
      .then((value) => active && setBoxes(value))
      .catch(() => active && setBoxes(null))
    return () => {
      active = false
    }
  }, [revision])
  return boxes
}
