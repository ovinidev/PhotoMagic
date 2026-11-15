import { vi, type Mock } from 'vitest'
import type { CameraStatus, DisplayState, FotomagicaApi } from '@shared/ipc'

type Listener<T> = (value: T) => void

/** `window.fotomagica` with every method replaced by a Vitest mock. */
export type MockedBridge = {
  [Area in keyof FotomagicaApi]: {
    [Method in keyof FotomagicaApi[Area]]: FotomagicaApi[Area][Method] extends (...args: never[]) => unknown
      ? Mock<FotomagicaApi[Area][Method]>
      : never
  }
}

type Overrides = { [Area in keyof FotomagicaApi]?: Partial<FotomagicaApi[Area]> }

export type BridgeStub = {
  api: MockedBridge
  pushDisplay: (state: DisplayState) => void
  pushCamera: (status: CameraStatus) => void
}

const CLOSED: DisplayState = { guest: { kind: 'missing' }, tv: { kind: 'closed' } }

/**
 * Installs a `window.fotomagica` stand-in for renderer tests. Defaults: version 0.1.0, no TV,
 * camera idle. `pushDisplay` and `pushCamera` emit the main → renderer events.
 */
export function stubBridge(overrides: Overrides = {}): BridgeStub {
  const displayListeners = new Set<Listener<DisplayState>>()
  const cameraListeners = new Set<Listener<CameraStatus>>()

  const api: MockedBridge = {
    app: {
      getVersion: vi.fn(overrides.app?.getVersion ?? (() => Promise.resolve({ version: '0.1.0', e2e: false }))),
    },
    display: {
      getState: vi.fn(overrides.display?.getState ?? (() => Promise.resolve(CLOSED))),
      onState: vi.fn(
        overrides.display?.onState ??
          ((listener) => {
            displayListeners.add(listener)
            return () => void displayListeners.delete(listener)
          }),
      ),
    },
    tv: {
      open: vi.fn(overrides.tv?.open ?? (() => Promise.resolve({ ok: false as const, reason: 'missing' as const, state: CLOSED }))),
      close: vi.fn(overrides.tv?.close ?? (() => Promise.resolve(CLOSED))),
    },
    camera: {
      getStatus: vi.fn(overrides.camera?.getStatus ?? (() => Promise.resolve<CameraStatus>({ kind: 'idle' }))),
      onStatus: vi.fn(
        overrides.camera?.onStatus ??
          ((listener) => {
            cameraListeners.add(listener)
            return () => void cameraListeners.delete(listener)
          }),
      ),
      report: vi.fn(overrides.camera?.report ?? (() => {})),
    },
  }

  window.fotomagica = api
  return {
    api,
    pushDisplay: (state) => displayListeners.forEach((listener) => listener(state)),
    pushCamera: (status) => cameraListeners.forEach((listener) => listener(status)),
  }
}
