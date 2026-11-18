import { useCallback, useEffect, useState } from 'react'
import { GUEST_TRANSITION_MS, type GuestScreen, type TransitionDirection, transitionDirection } from './screens'

export interface ScreenTransition<T> {
  /** Direction of the last screen change; `none` before the first one. */
  direction: TransitionDirection
  /** The screen that is sliding out on back, with the payload it last rendered; `null` otherwise. */
  leaving: { screen: GuestScreen; payload: T } | null
  /** Drops `leaving` once its exit animation ends. */
  endLeaving: () => void
}

/**
 * Tracks the guest screen and the direction it last moved in. On back the previous screen stays
 * mounted with its last payload for one transition, so it can slide out; a timer drops it even
 * when `animationend` never fires (reduced motion with no animation, jsdom).
 */
export function useScreenTransition<T>(screen: GuestScreen, payload: T): ScreenTransition<T> {
  const [state, setState] = useState<{ screen: GuestScreen; payload: T; direction: TransitionDirection; leaving: ScreenTransition<T>['leaving'] }>({
    screen,
    payload,
    direction: 'none',
    leaving: null,
  })

  // Derived during render (React's "adjust state on prop change"), so the leaving layer and the
  // new screen appear in the same commit, without a frame where the old screen is gone.
  if (state.screen !== screen) {
    const direction = transitionDirection(state.screen, screen)
    setState({ screen, payload, direction, leaving: direction === 'back' ? { screen: state.screen, payload: state.payload } : null })
  } else if (state.payload !== payload) {
    setState({ ...state, payload })
  }

  const endLeaving = useCallback(() => setState((current) => (current.leaving ? { ...current, leaving: null } : current)), [])

  useEffect(() => {
    if (!state.leaving) return
    const timer = window.setTimeout(endLeaving, GUEST_TRANSITION_MS + 100)
    return () => window.clearTimeout(timer)
  }, [state.leaving, endLeaving])

  return { direction: state.direction, leaving: state.leaving, endLeaving }
}
