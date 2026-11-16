import { chooseGuestDisplay, placeGuestWindow, type DisplayInfo } from '@shared/displays'
import type { DisplayState, TvOpenInput, TvOpenResult, TvWindowState } from '@shared/ipc'
import type { DisplaySource } from './displaySource'

/** What the controller needs from the TV `BrowserWindow`. Injected so the logic is tested without Electron. */
export type GuestWindowHandle = {
  /** Covers the monitor and makes the window visible. Called again when the monitor's bounds change. */
  place: (display: DisplayInfo) => void
  /** Takes the window off screen without destroying it: the camera and the round stay in memory. */
  hide: () => void
  /** Closes for real, bypassing the accidental-close guard. */
  destroy: () => void
  /** Fires once when the window is gone, whoever closed it. */
  onClosed: (listener: () => void) => void
}

export type GuestWindowController = {
  state: () => DisplayState
  open: (input: TvOpenInput) => TvOpenResult
  close: () => DisplayState
  /** The two-finger hold on the TV: hides an open TV window without closing it or ending the event. */
  dismiss: () => DisplayState
  /** The laptop's `Abrir TV`: puts a hidden window back on the TV, if one is eligible. */
  reopen: () => DisplayState
  /** Called on every monitor change and every TV window change. */
  onChange: (listener: (state: DisplayState) => void) => void
}

/**
 * Owns the single TV window (DESIGN §3). It opens only on the monitor chosen by the pure display
 * rules, follows monitor changes at runtime, hides (never moves onto the laptop) when the TV goes
 * away, comes back when an eligible TV returns, and closes only through `close` or app quit.
 */
export function createGuestWindowController(deps: {
  displays: DisplaySource
  createWindow: () => GuestWindowHandle
}): GuestWindowController {
  let handle: GuestWindowHandle | null = null
  let tv: TvWindowState = { kind: 'closed' }
  let allowLandscape = false
  const listeners: Array<(state: DisplayState) => void> = []

  const state = (): DisplayState => ({ guest: chooseGuestDisplay(deps.displays.list()), tv })
  const notify = () => {
    const current = state()
    for (const listener of listeners) listener(current)
  }

  /** Moves, shows or hides the existing window to match the current monitors. */
  const reconcile = (window: GuestWindowHandle) => {
    const placement = placeGuestWindow({
      displays: deps.displays.list(),
      currentDisplayId: tv.kind === 'open' ? tv.display.id : null,
      allowLandscape,
    })
    if (placement.kind === 'show') {
      // `display-metrics-changed` also fires for work-area or scale changes elsewhere: re-placing
      // an unchanged TV would toggle fullscreen and flicker in front of the guests.
      if (!(tv.kind === 'open' && sameBounds(tv.display, placement.display))) window.place(placement.display)
      tv = { kind: 'open', display: placement.display }
    } else {
      if (tv.kind === 'open') window.hide()
      tv = { kind: 'detached', reason: placement.reason }
    }
  }

  deps.displays.onChange(() => {
    // A window the guests hid stays hidden until the operator reopens it.
    if (handle && tv.kind !== 'hidden') reconcile(handle)
    notify()
  })

  return {
    state,

    open: (input) => {
      const allow = allowLandscape || input.allowLandscape
      if (!handle) {
        const placement = placeGuestWindow({ displays: deps.displays.list(), currentDisplayId: null, allowLandscape: allow })
        if (placement.kind === 'hide') return { ok: false, reason: placement.reason, state: state() }
        allowLandscape = allow
        const window = deps.createWindow()
        handle = window
        window.onClosed(() => {
          if (handle !== window) return
          handle = null
          tv = { kind: 'closed' }
          allowLandscape = false
          notify()
        })
      }
      allowLandscape = allow
      reconcile(handle)
      notify()
      return tv.kind === 'detached' ? { ok: false, reason: tv.reason, state: state() } : { ok: true, state: state() }
    },

    close: () => {
      const window = handle
      handle = null
      tv = { kind: 'closed' }
      allowLandscape = false
      window?.destroy()
      notify()
      return state()
    },

    dismiss: () => {
      if (!handle || tv.kind !== 'open') return state()
      handle.hide()
      tv = { kind: 'hidden' }
      notify()
      return state()
    },

    reopen: () => {
      if (!handle || tv.kind !== 'hidden') return state()
      reconcile(handle)
      notify()
      return state()
    },

    onChange: (listener) => {
      listeners.push(listener)
    },
  }
}

function sameBounds(a: DisplayInfo, b: DisplayInfo): boolean {
  return a.id === b.id && a.x === b.x && a.y === b.y && a.width === b.width && a.height === b.height
}
