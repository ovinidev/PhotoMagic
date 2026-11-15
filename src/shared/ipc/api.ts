import type { AppVersion, CameraStatus, DisplayState, TvOpenInput, TvOpenResult } from './schemas'

/** Stops a subscription made with one of the `on…` methods. */
export type Unsubscribe = () => void

/** Shape of `window.fotomagica`, the only bridge from a renderer to the main process. */
export type FotomagicaApi = {
  app: {
    getVersion: () => Promise<AppVersion>
  }
  display: {
    /** Monitor choice for the TV and the TV window state. */
    getState: () => Promise<DisplayState>
    /** Pushed on every monitor added, removed or changed, and on every TV window change. */
    onState: (listener: (state: DisplayState) => void) => Unsubscribe
  }
  tv: {
    /** Opens the camera window on the TV monitor, or says why it cannot (RF04). */
    open: (input: TvOpenInput) => Promise<TvOpenResult>
    /** Closes the camera window for real. */
    close: () => Promise<DisplayState>
  }
  camera: {
    getStatus: () => Promise<CameraStatus>
    onStatus: (listener: (status: CameraStatus) => void) => Unsubscribe
    /** TV window only: reports its camera state. Main ignores it from any other window. */
    report: (status: CameraStatus) => void
  }
}
