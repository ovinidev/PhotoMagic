import type { AppVersion } from './schemas'

/** Shape of `window.fotomagica`, the only bridge from a renderer to the main process. */
export type FotomagicaApi = {
  app: {
    getVersion: () => Promise<AppVersion>
  }
}
