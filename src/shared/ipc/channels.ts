/**
 * Stable IPC channel names. The renderer never builds these strings by hand:
 * it only calls the typed `window.fotomagica` object exposed by the preload.
 */
export const IPC_CHANNELS = {
  appGetVersion: 'app:get-version',
} as const

export type IpcChannel = (typeof IPC_CHANNELS)[keyof typeof IPC_CHANNELS]
