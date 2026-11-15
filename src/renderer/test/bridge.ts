import { vi, type Mock } from 'vitest'
import { SEED_LAYOUTS } from '@shared/layout'
import type { CameraStatus, DisplayState, FotomagicaApi, PrinterStatus, SessionState, Templates, WebcamState } from '@shared/ipc'

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
  pushSession: (state: SessionState) => void
  pushShutter: () => void
  pushPrinter: (status: PrinterStatus) => void
  pushGallery: () => void
  pushWebcam: (state: WebcamState) => void
}

const CLOSED: DisplayState = { guest: { kind: 'missing' }, tv: { kind: 'closed' } }
const NO_TEMPLATES: Templates = { 'two-strips': null, 'one-strip': null }
const IDLE: SessionState = { kind: 'idle' }
const NO_WEBCAM: WebcamState = { values: { controls: {} }, capabilities: null, live: false }

function listeners<T>() {
  const set = new Set<Listener<T>>()
  return {
    add: (listener: Listener<T>) => {
      set.add(listener)
      return () => void set.delete(listener)
    },
    push: (value: T) => set.forEach((listener) => listener(value)),
  }
}

/**
 * Installs a `window.fotomagica` stand-in for renderer tests. Defaults: version 0.1.0, no TV, camera
 * idle, no templates, no event, printer ready. `push…` emit the main → renderer events.
 */
export function stubBridge(overrides: Overrides = {}): BridgeStub {
  const display = listeners<DisplayState>()
  const camera = listeners<CameraStatus>()
  const session = listeners<SessionState>()
  const shutter = listeners<void>()
  const printer = listeners<PrinterStatus>()
  const gallery = listeners<void>()
  const webcam = listeners<WebcamState>()
  const o = overrides

  const api: MockedBridge = {
    app: {
      getVersion: vi.fn(o.app?.getVersion ?? (() => Promise.resolve({ version: '0.1.0', e2e: false }))),
    },
    display: {
      getState: vi.fn(o.display?.getState ?? (() => Promise.resolve(CLOSED))),
      onState: vi.fn(o.display?.onState ?? display.add),
    },
    camera: {
      getStatus: vi.fn(o.camera?.getStatus ?? (() => Promise.resolve<CameraStatus>({ kind: 'idle' }))),
      onStatus: vi.fn(o.camera?.onStatus ?? camera.add),
      report: vi.fn(o.camera?.report ?? (() => {})),
      requestPreviewPort: vi.fn(o.camera?.requestPreviewPort ?? (() => {})),
    },
    template: {
      getAll: vi.fn(o.template?.getAll ?? (() => Promise.resolve(NO_TEMPLATES))),
      import: vi.fn(o.template?.import ?? (() => Promise.resolve({ ok: false as const, reason: 'unreadable' as const }))),
    },
    layout: {
      get: vi.fn(o.layout?.get ?? (() => Promise.resolve(SEED_LAYOUTS))),
      save: vi.fn<FotomagicaApi['layout']['save']>(
        o.layout?.save ?? ((input) => Promise.resolve({ ok: true, layouts: { 'two-strips': [...SEED_LAYOUTS['two-strips']], 'one-strip': [...SEED_LAYOUTS['one-strip']], [input.mode]: input.slots } })),
      ),
    },
    event: {
      start: vi.fn(o.event?.start ?? (() => Promise.resolve({ ok: false as const, reason: 'missing' as const }))),
      end: vi.fn(o.event?.end ?? (() => Promise.resolve(IDLE))),
    },
    session: {
      getState: vi.fn(o.session?.getState ?? (() => Promise.resolve(IDLE))),
      onState: vi.fn(o.session?.onState ?? session.add),
      getPreview: vi.fn(o.session?.getPreview ?? (() => Promise.resolve({ revision: 0, jpeg: null }))),
      setTimer: vi.fn(o.session?.setTimer ?? (() => Promise.resolve(IDLE))),
      setCopies: vi.fn(o.session?.setCopies ?? (() => Promise.resolve(IDLE))),
      setFraming: vi.fn(o.session?.setFraming ?? (() => Promise.resolve(IDLE))),
      cancel: vi.fn(o.session?.cancel ?? (() => Promise.resolve(IDLE))),
      print: vi.fn(o.session?.print ?? (() => Promise.resolve(IDLE))),
      reprint: vi.fn(o.session?.reprint ?? (() => Promise.resolve(IDLE))),
      newRound: vi.fn(o.session?.newRound ?? (() => Promise.resolve(IDLE))),
      requestShutter: vi.fn(o.session?.requestShutter ?? (() => {})),
      onShutter: vi.fn(o.session?.onShutter ?? ((listener: () => void) => shutter.add(listener))),
      sendPhoto: vi.fn(o.session?.sendPhoto ?? (() => {})),
    },
    webcam: {
      getState: vi.fn(o.webcam?.getState ?? (() => Promise.resolve(NO_WEBCAM))),
      set: vi.fn<FotomagicaApi['webcam']['set']>(o.webcam?.set ?? ((values) => Promise.resolve({ ...NO_WEBCAM, values }))),
      report: vi.fn(o.webcam?.report ?? (() => {})),
      onState: vi.fn(o.webcam?.onState ?? webcam.add),
    },
    gallery: {
      list: vi.fn(o.gallery?.list ?? (() => Promise.resolve({ fileNames: [] }))),
      get: vi.fn(o.gallery?.get ?? (() => Promise.resolve({ jpeg: null }))),
      reprint: vi.fn(o.gallery?.reprint ?? (() => Promise.resolve({ ok: true as const }))),
      onChanged: vi.fn(o.gallery?.onChanged ?? ((listener: () => void) => gallery.add(listener))),
    },
    printer: {
      getStatus: vi.fn(o.printer?.getStatus ?? (() => Promise.resolve<PrinterStatus>({ kind: 'ready' }))),
      onStatus: vi.fn(o.printer?.onStatus ?? printer.add),
    },
  }

  window.fotomagica = api
  return { api, pushDisplay: display.push, pushCamera: camera.push, pushSession: session.push, pushShutter: () => shutter.push(), pushPrinter: printer.push, pushGallery: () => gallery.push(), pushWebcam: webcam.push }
}

/** An open event in 2 tiras, capturing, for renderer tests. */
export function eventState(overrides: Partial<Extract<SessionState, { kind: 'event' }>> = {}): Extract<SessionState, { kind: 'event' }> {
  return {
    kind: 'event',
    name: 'Aniversário AJ',
    mode: 'two-strips',
    timer: 0,
    copies: 1,
    taken: 0,
    previewRevision: 1,
    framings: {},
    slots: [
      { id: 'top-1', photo: 1, left: 72, top: 70, width: 500, height: 281, angle: 270 },
      { id: 'bottom-1', photo: 1, left: 72, top: 670, width: 500, height: 281, angle: 0 },
    ],
    phase: { kind: 'capturing' },
    ...overrides,
  }
}
