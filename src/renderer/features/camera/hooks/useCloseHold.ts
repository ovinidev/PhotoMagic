import { useEffect, useState } from 'react'
import { IDLE, holdProgress, nextHold, type HoldInput, type Point } from '@shared/closeHold'

const points = (touches: TouchList): Point[] => Array.from(touches, (touch) => ({ x: touch.clientX, y: touch.clientY }))

/**
 * TV side of the two-finger close hold (DESIGN §3). Listens to touches on the whole window, so it
 * works over the camera and the print screen alike, without stopping them from reaching the UI.
 * Returns the hint progress (0..1) or `null`; `onFire` should be stable (a hold restarts if it changes).
 */
export function useCloseHold(onFire: () => void): number | null {
  const [progress, setProgress] = useState<number | null>(null)
  useEffect(() => {
    let state = IDLE
    let frame = 0
    const step = (input: HoldInput) => {
      const result = nextHold(state, input)
      state = result.state
      setProgress(holdProgress(state, input.at))
      if (result.fire) onFire()
      cancelAnimationFrame(frame)
      if (state.kind === 'holding') frame = requestAnimationFrame(() => step({ type: 'tick', at: performance.now() }))
    }
    const onTouch = (event: TouchEvent) => step({ type: 'touches', at: performance.now(), points: points(event.touches) })
    const types = ['touchstart', 'touchmove', 'touchend', 'touchcancel'] as const
    for (const type of types) window.addEventListener(type, onTouch, { capture: true, passive: true })
    return () => {
      cancelAnimationFrame(frame)
      for (const type of types) window.removeEventListener(type, onTouch, { capture: true })
    }
  }, [onFire])

  return progress
}
