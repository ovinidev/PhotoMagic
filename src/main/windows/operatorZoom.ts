import type { BrowserWindow } from 'electron'
import type { ZoomState } from '@shared/ipc'
import { DEFAULT_USER_ZOOM, autoZoom, effectiveZoom, stepUserZoom, type ZoomStep } from '@shared/zoom'
import { readConfig, updateConfig } from '../persist'

export type OperatorZoom = {
  /** Starts following the laptop window: applies the zoom on load and on every resize. */
  attach: (window: BrowserWindow) => void
  state: () => ZoomState
  /** One operator step, saved in `config.json` on this computer, then applied. */
  step: (step: ZoomStep) => Promise<ZoomState>
}

/**
 * The laptop window zoom (DESIGN §3): `autoZoom(content size) × the operator's zoom`, applied with
 * `webContents.setZoomFactor` to the laptop window only. The TV window is never touched here.
 */
export function createOperatorZoom({ userData, onChange }: { userData: string; onChange: (state: ZoomState) => void }): OperatorZoom {
  let window: BrowserWindow | null = null
  let user = DEFAULT_USER_ZOOM
  let current: ZoomState = { user, auto: 1, effective: 1 }
  let pending: ReturnType<typeof setTimeout> | null = null

  const apply = () => {
    if (!window || window.isDestroyed()) return
    const [width = 0, height = 0] = window.getContentSize()
    const auto = autoZoom({ width, height })
    const next: ZoomState = { user, auto, effective: effectiveZoom(auto, user) }
    window.webContents.setZoomFactor(next.effective)
    if (next.user === current.user && next.auto === current.auto && next.effective === current.effective) return
    current = next
    onChange(current)
  }

  // Resizing fires many events; one zoom change per settled size keeps the layout from jittering.
  const applySoon = () => {
    if (pending) clearTimeout(pending)
    pending = setTimeout(() => {
      pending = null
      apply()
    }, 60)
  }

  const loaded = readConfig(userData)
    .then((config) => {
      user = config.zoom
    })
    .catch(() => {})

  return {
    attach: (target) => {
      window = target
      void loaded.then(apply)
      target.on('resize', applySoon)
      target.on('maximize', applySoon)
      target.on('unmaximize', applySoon)
      // Chromium may reset the factor on a (re)load; put it back.
      target.webContents.on('did-finish-load', apply)
      target.on('closed', () => {
        if (pending) clearTimeout(pending)
        window = null
      })
    },
    state: () => current,
    step: async (step) => {
      await loaded
      user = stepUserZoom(user, step)
      apply()
      await updateConfig(userData, (config) => ({ ...config, zoom: user })).catch(() => {})
      return current
    },
  }
}
