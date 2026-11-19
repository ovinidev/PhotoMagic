import type { Layouts, PhotoIndex } from '../layout'
import type { ShareSettings } from '../share/settings'
import type { WebcamValues } from '../webcam'
import type {
  AppVersion,
  CameraStatus,
  DisplayState,
  EventStartInput,
  EventStartResult,
  GalleryGetInput,
  GalleryImage,
  GalleryList,
  GalleryReprintResult,
  LayoutSaveInput,
  LayoutSaveResult,
  PrinterStatus,
  SessionPhoto,
  SessionPreview,
  SessionState,
  SetFramingInput,
  TemplateImportInput,
  TemplateImportResult,
  Templates,
  Timer,
  UpdateStatus,
  ZoomState,
  ShareState,
  WebcamReport,
  WebcamState,
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
    /** TV only: the two-finger hold hides the TV window; the event and the round go on. */
    hideTv: () => Promise<DisplayState>
    /** Laptop only: puts a hidden TV window back on the TV. */
    showTv: () => Promise<DisplayState>
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
    /** One capture of the current round (upright, mirrored), or `null`; the laptop draws the framing drag with it. */
    getPhoto: (index: PhotoIndex) => Promise<Uint8Array | null>
    setTimer: (timer: Timer) => Promise<SessionState>
    setCopies: (copies: number) => Promise<SessionState>
    /** Pan, zoom and rotation of one filled slot of the round, before the montage is saved (RF09). */
    setFraming: (input: SetFramingInput) => Promise<SessionState>
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
  webcam: {
    /** Saved values, the camera's last advertised controls, and whether the TV has it open (RF15). */
    getState: () => Promise<WebcamState>
    /** Saves the values (both windows write the same state); the TV applies them to the camera. */
    set: (values: WebcamValues) => Promise<WebcamState>
    /** TV only: the open camera's capabilities, or `null` when it is not open. */
    report: (report: WebcamReport) => void
    /** Pushed to both windows on every change. */
    onState: (listener: (state: WebcamState) => void) => Unsubscribe
  }
  gallery: {
    /** The event folder's montages, newest first; only the app's `HH-mm-ss.jpg` files (RF14). */
    list: () => Promise<GalleryList>
    /** One montage, as the file or as a thumbnail. */
    get: (input: GalleryGetInput) => Promise<GalleryImage>
    /** `Imprimir novamente` from the gallery menu: resends that file, one copy, in the event's mode. */
    reprint: (fileName: string) => Promise<GalleryReprintResult>
    /** Pushed after a montage is written in the event folder. */
    onChanged: (listener: () => void) => Unsubscribe
  }
  printer: {
    /** The DS-RX1 as the spooler reports it now (DESIGN §10). */
    getStatus: () => Promise<PrinterStatus>
    /** Pushed to both windows whenever the reported state changes. */
    onStatus: (listener: (status: PrinterStatus) => void) => Unsubscribe
  }
  update: {
    /** Background auto-update (DESIGN §11): a download in progress or one that installs on quit. */
    getStatus: () => Promise<UpdateStatus>
    /** Pushed whenever the update status changes. */
    onStatus: (listener: (status: UpdateStatus) => void) => Unsubscribe
  }
  zoom: {
    /** The laptop window zoom: automatic factor, the operator's zoom and their product (DESIGN §3). */
    get: () => Promise<ZoomState>
    /** One operator step (Ctrl + / Ctrl − / Ctrl 0); saved on this computer. */
    step: (step: 'in' | 'out' | 'reset') => Promise<ZoomState>
    /** Pushed when the window is resized or the operator zooms. */
    onState: (listener: (state: ZoomState) => void) => Unsubscribe
  }
  share: {
    /** The operator's offline download settings: on/off, port, address override, hotspot Wi-Fi (DESIGN §15). */
    getSettings: () => Promise<ShareSettings>
    /** Saves the settings and restarts the local server; returns the new state. Laptop only. */
    saveSettings: (settings: ShareSettings) => Promise<ShareState>
    getState: () => Promise<ShareState>
    /** Pushed when the server starts or stops and when a round's photo link appears or goes. */
    onState: (listener: (state: ShareState) => void) => Unsubscribe
  }
}
