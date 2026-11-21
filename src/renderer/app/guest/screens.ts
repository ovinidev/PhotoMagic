import type { EventSession } from '@shared/ipc'

/** The guest (TV) screens: the live camera, then the print screen over it. */
export type GuestScreen = 'camera' | 'print'

/** Which screen the TV shows: the print screen from `review` on, the camera otherwise. */
export function guestScreen(session: EventSession | null): GuestScreen {
  return session && session.phase.kind !== 'capturing' ? 'print' : 'camera'
}
