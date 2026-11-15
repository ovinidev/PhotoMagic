import type { Layouts } from '../layout'
import type {
  AppVersion,
  CameraStatus,
  DisplayState,
  EventStartInput,
  EventStartResult,
  LayoutSaveInput,
  LayoutSaveResult,
  SessionPhoto,
  SessionPreview,
  SessionState,
  TemplateImportInput,
  TemplateImportResult,
  Templates,
  Timer,
} from './schemas'

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
  camera: {
    getStatus: () => Promise<CameraStatus>
    onStatus: (listener: (status: CameraStatus) => void) => Unsubscribe
    /** TV window only: reports its camera state. Main ignores it from any other window. */
    report: (status: CameraStatus) => void
    /**
     * Asks main for a fresh live-preview `MessageChannel` between the TV and the laptop. Each window
     * receives its end as a `window` message whose data is `PREVIEW_PORT_MESSAGE` (DESIGN §5).
     */
    requestPreviewPort: () => void
  }
  template: {
    /** Each mode's stored template, or `null` (PRD §6.1). */
    getAll: () => Promise<Templates>
    /** Stores a 1844×1240 PNG or JPEG as that mode's template, or says why not (RF01). */
    import: (input: TemplateImportInput) => Promise<TemplateImportResult>
  }
  layout: {
    /** Both saved layouts, or the PRD seeds on first run (RF03). */
    get: () => Promise<Layouts>
    /** Writes the layout of one mode only, once per gesture, on release (DESIGN §7). Refused while an event runs. */
    save: (input: LayoutSaveInput) => Promise<LayoutSaveResult>
  }
  event: {
    /** Checks the name and the template, opens the TV and creates or reuses `Desktop\<name>` (RF01, RF02, RF04). */
    start: (input: EventStartInput) => Promise<EventStartResult>
    /** Closes the TV and forgets the unprinted round (RF16). */
    end: () => Promise<SessionState>
  }
  session: {
    getState: () => Promise<SessionState>
    /** Pushed to both windows on every change of the event or its round. */
    onState: (listener: (state: SessionState) => void) => Unsubscribe
    /** The current montage preview JPEG and its revision. */
    getPreview: () => Promise<SessionPreview>
    setTimer: (timer: Timer) => Promise<SessionState>
    setCopies: (copies: number) => Promise<SessionState>
    /** `Cancelar`: discards the round, no file (RF10). */
    cancel: () => Promise<SessionState>
    /** `Imprimir`: composes, writes `HH-mm-ss.jpg`, sends it to the printer (RF11, RF12). */
    print: () => Promise<SessionState>
    /** `Imprimir novamente`: resends the same JPG with the current copies (RF13). */
    reprint: () => Promise<SessionState>
    /** `Nova rodada`: back to the camera at 1/3 (RF13). */
    newRound: () => Promise<SessionState>
    /** Laptop: asks main to run the TV's shutter, timer included (RF06). */
    requestShutter: () => void
    /** TV only: main runs the shutter (the laptop asked for it). */
    onShutter: (listener: () => void) => Unsubscribe
    /** TV only: delivers photo `index`, already rotated and mirrored. Main ignores other windows. */
    sendPhoto: (photo: SessionPhoto) => void
  }
}
