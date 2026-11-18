import type { EventSession } from '@shared/ipc'

/**
 * The guest (TV) screens, in navigation order: the live camera, then the print screen over it.
 * Moving to a later screen is forward, to an earlier one is back (DESIGN §14, Motion).
 */
export const GUEST_SCREENS = ['camera', 'print'] as const
export type GuestScreen = (typeof GUEST_SCREENS)[number]

export type TransitionDirection = 'forward' | 'back' | 'none'

/** Length of a guest screen transition, kept in sync with the `guest-screen-*` keyframes in `index.css`. */
export const GUEST_TRANSITION_MS = 300

/** Which screen the TV shows: the print screen from `review` on, the camera otherwise. */
export function guestScreen(session: EventSession | null): GuestScreen {
  return session && session.phase.kind !== 'capturing' ? 'print' : 'camera'
}

/** Forward when `to` comes after `from` in `GUEST_SCREENS`, back when before, none when it is the same screen. */
export function transitionDirection(from: GuestScreen, to: GuestScreen): TransitionDirection {
  const delta = GUEST_SCREENS.indexOf(to) - GUEST_SCREENS.indexOf(from)
  return delta > 0 ? 'forward' : delta < 0 ? 'back' : 'none'
}

/**
 * The animation class of a screen layer. The entering screen fades and zooms in on forward; the
 * leaving screen slides out on back, uncovering the earlier one, which never left. `index.css`
 * turns both into a plain fade under `prefers-reduced-motion`.
 */
export function transitionClass(direction: TransitionDirection, role: 'entering' | 'leaving'): string | undefined {
  if (direction === 'forward' && role === 'entering') return 'guest-screen-enter-forward'
  if (direction === 'back' && role === 'leaving') return 'guest-screen-exit-back'
  return undefined
}
