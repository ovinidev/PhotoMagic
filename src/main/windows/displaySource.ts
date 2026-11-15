import { screen } from 'electron'
import type { DisplayInfo } from '@shared/displays'

/** Where main reads the monitor list from: Electron's `screen`, or a fixture under E2E. */
export type DisplaySource = {
  list: () => DisplayInfo[]
  /** Called after a monitor is added, removed, or changes bounds or rotation. */
  onChange: (listener: () => void) => void
}

/** Thin shell over `screen`: maps each display's DIP bounds to `DisplayInfo`. Call after `app` is ready. */
export function createScreenDisplaySource(): DisplaySource {
  return {
    list: () => {
      const primaryId = screen.getPrimaryDisplay().id
      return screen.getAllDisplays().map(({ id, bounds }) => ({
        id,
        primary: id === primaryId,
        x: Math.round(bounds.x),
        y: Math.round(bounds.y),
        width: Math.round(bounds.width),
        height: Math.round(bounds.height),
      }))
    },
    onChange: (listener) => {
      screen.on('display-added', () => listener())
      screen.on('display-removed', () => listener())
      screen.on('display-metrics-changed', () => listener())
    },
  }
}
