import { useCallback, useEffect, useState } from 'react'
import { ATTRACT_IDLE_MS } from '../utils/slides'

export interface AttractIdle {
  /** The attract screen is up. */
  showing: boolean
  /** A guest touched it: hide it and start counting idle time again. */
  dismiss: () => void
}

/**
 * When the TV shows the attract screen (DESIGN §14, Attract screen): only while `active` (a fresh
 * round, nothing taken yet), after `idleMs` with no pointer or key on the window. Any touch restarts
 * the count; leaving `active` (the first photo, the print screen) hides it at once.
 */
export function useAttractIdle(active: boolean, idleMs = ATTRACT_IDLE_MS): AttractIdle {
  const [idle, setIdle] = useState(false)
  const [activity, setActivity] = useState(0)
  const [wasActive, setWasActive] = useState(active)

  // Leaving a fresh round forgets the idle state, so the next round starts counting from zero.
  if (wasActive !== active) {
    setWasActive(active)
    if (!active) setIdle(false)
  }

  useEffect(() => {
    if (!active) return
    const bump = () => setActivity((value) => value + 1)
    window.addEventListener('pointerdown', bump, true)
    window.addEventListener('keydown', bump, true)
    return () => {
      window.removeEventListener('pointerdown', bump, true)
      window.removeEventListener('keydown', bump, true)
    }
  }, [active])

  useEffect(() => {
    if (!active) return
    const timer = window.setTimeout(() => setIdle(true), idleMs)
    return () => window.clearTimeout(timer)
  }, [active, activity, idleMs])

  const dismiss = useCallback(() => {
    setIdle(false)
    setActivity((value) => value + 1)
  }, [])

  return { showing: active && idle, dismiss }
}
