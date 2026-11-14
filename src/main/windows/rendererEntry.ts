import { join } from 'node:path'
import type { BrowserWindow } from 'electron'

export type RendererPage = 'operator' | 'guest'

export const PRELOAD_PATH = join(__dirname, '../preload/index.js')

/** Loads one of the two HTML entries: the Vite dev server in `pnpm dev`, the built file otherwise. */
export function loadRendererPage(window: BrowserWindow, page: RendererPage): Promise<void> {
  const devServerUrl = process.env['ELECTRON_RENDERER_URL']
  if (devServerUrl) return window.loadURL(`${devServerUrl}/${page}.html`)
  return window.loadFile(join(__dirname, `../renderer/${page}.html`))
}

/** Same hardening for both windows: no navigation away from the app and no new windows. */
export function lockNavigation(window: BrowserWindow): void {
  window.webContents.on('will-navigate', (event) => event.preventDefault())
  window.webContents.setWindowOpenHandler(() => ({ action: 'deny' }))
}

export const SECURE_WEB_PREFERENCES = {
  preload: PRELOAD_PATH,
  contextIsolation: true,
  nodeIntegration: false,
  sandbox: true,
  webSecurity: true,
} as const
