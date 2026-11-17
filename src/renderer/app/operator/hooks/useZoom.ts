import { useEffect } from 'react'

type Step = 'in' | 'out' | 'reset'

/** The key that zooms with Ctrl held, or `null`. `=` is the unshifted `+` on most layouts. */
export function zoomKeyStep(event: Pick<KeyboardEvent, 'key' | 'code' | 'ctrlKey' | 'metaKey' | 'altKey'>): Step | null {
  if (!(event.ctrlKey || event.metaKey) || event.altKey) return null
  if (event.key === '+' || event.key === '=' || event.code === 'NumpadAdd') return 'in'
  if (event.key === '-' || event.key === '_' || event.code === 'NumpadSubtract') return 'out'
  if (event.key === '0' || event.code === 'Numpad0' || event.code === 'Digit0') return 'reset'
  return null
}

/** One wheel step at most this often: a trackpad sends a burst of small deltas per gesture. */
const WHEEL_STEP_MS = 120

/**
 * The laptop window zoom shortcuts (DESIGN §3): Ctrl + / Ctrl − / Ctrl 0 and Ctrl + wheel, each one a
 * `zoom:step` to main, which owns and saves the state. There are no zoom buttons. A surface that zooms itself
 * (the slot editor's sheet) calls `preventDefault` on its wheel event first, and the window then leaves that wheel alone.
 */
export function useZoom(): void {
  useEffect(() => {
    const step = (direction: Step) => {
      void window.fotomagica.zoom
        .step(direction)
        .catch(() => {})
    }
    const onKey = (event: KeyboardEvent) => {
      const direction = zoomKeyStep(event)
      if (!direction) return
      event.preventDefault()
      step(direction)
    }
    let lastWheel = 0
    const onWheel = (event: WheelEvent) => {
      if (!event.ctrlKey || event.defaultPrevented || event.deltaY === 0) return
      event.preventDefault()
      if (event.timeStamp - lastWheel < WHEEL_STEP_MS) return
      lastWheel = event.timeStamp
      step(event.deltaY < 0 ? 'in' : 'out')
    }
    window.addEventListener('keydown', onKey)
    window.addEventListener('wheel', onWheel, { passive: false })
    return () => {
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('wheel', onWheel)
    }
  }, [])
}
