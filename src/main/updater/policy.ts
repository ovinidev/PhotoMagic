/**
 * Whether startup may look for an update (DESIGN §11): only in an installed build, never under E2E,
 * and never with an event in progress.
 */
export function shouldCheckForUpdates(state: { packaged: boolean; e2e: boolean; eventOpen: boolean }): boolean {
  return state.packaged && !state.e2e && !state.eventOpen
}
