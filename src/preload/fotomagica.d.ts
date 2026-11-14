import type { FotomagicaApi } from '@shared/ipc'

declare global {
  interface Window {
    /** The only bridge from a renderer to the main process. Exposed by `src/preload/index.ts`. */
    fotomagica: FotomagicaApi
  }
}

export {}
