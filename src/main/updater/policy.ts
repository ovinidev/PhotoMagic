import type { UpdateStatus } from '@shared/ipc'

/**
 * Whether startup may look for an update (DESIGN §11): only in an installed build, never under E2E,
 * never with an event in progress and never without a network (the party usually has none).
 */
export function shouldCheckForUpdates(state: { packaged: boolean; e2e: boolean; eventOpen: boolean; online: boolean }): boolean {
  return state.packaged && !state.e2e && !state.eventOpen && state.online
}

/** What electron-updater reported, reduced to what the laptop needs to know. */
export type UpdaterEvent =
  | { kind: 'available'; version: string }
  | { kind: 'progress'; percent: number }
  | { kind: 'downloaded'; version: string }
  | { kind: 'not-available' }
  | { kind: 'error' }

/**
 * Next laptop status after an updater event. A finished download stays `ready` whatever comes next:
 * it installs when the app quits. Any error before that falls back to `idle`, silently.
 */
export function nextUpdateStatus(current: UpdateStatus, event: UpdaterEvent): UpdateStatus {
  if (current.kind === 'ready') return current
  switch (event.kind) {
    case 'available':
      return { kind: 'downloading', version: event.version, percent: 0 }
    case 'progress':
      if (current.kind !== 'downloading') return current
      return { ...current, percent: Math.min(100, Math.max(0, Math.round(event.percent))) }
    case 'downloaded':
      return { kind: 'ready', version: event.version }
    case 'not-available':
    case 'error':
      return { kind: 'idle' }
  }
}
