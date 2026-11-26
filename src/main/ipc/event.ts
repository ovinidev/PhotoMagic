import { mkdir } from 'node:fs/promises'
import { join } from 'node:path'
import type { WebContents } from 'electron'
import { checkEventName } from '@shared/files'
import type { Layouts } from '@shared/layout'
import { IPC_CHANNELS, type EventStartResult, type SessionState } from '@shared/ipc'
import { detectTemplateBoxes } from '../compose/detectBoxes'
import { importTemplate, listTemplates, readConfig, readTemplate, saveLayout } from '../persist'
import type { Session } from '../session'
import type { GuestWindowController } from '../windows'
import { broadcast, handleInvoke, handleSend, sendTo } from './handle'

export type EventDeps = {
  tv: GuestWindowController
  session: Session
  /** Electron's `userData` (or the E2E folder). */
  userData: string
  /** `app.getPath('desktop')` (or the E2E folder): the event folder is `<desktop>/<name>` (RF02). */
  desktop: string
  isGuestWindow: (contents: WebContents) => boolean
  guestContents: () => WebContents | null
}

/** `template:*`, `event:*` and `session:*` (DESIGN §4): main owns the event and the round. */
export function registerEventHandlers(deps: EventDeps): void {
  const { tv, session } = deps

  handleInvoke(IPC_CHANNELS.templateGetAll, () => listTemplates(deps.userData))
  handleInvoke(IPC_CHANNELS.templateImport, ({ mode, fileName, bytes }) => importTemplate(deps.userData, mode, fileName, bytes))

  handleInvoke(IPC_CHANNELS.layoutGet, async () => mutableLayouts((await readConfig(deps.userData)).layouts))
  handleInvoke(IPC_CHANNELS.layoutSave, async ({ mode, slots }) => {
    // The editor does not open while an event runs (PRD §6.3); main refuses the write as well.
    if (session.isOpen()) return { ok: false, reason: 'event-open' }
    try {
      return { ok: true, layouts: mutableLayouts((await saveLayout(deps.userData, mode, slots)).layouts) }
    } catch {
      return { ok: false, reason: 'failed' }
    }
  })

  handleInvoke(IPC_CHANNELS.eventStart, async ({ name, mode }): Promise<EventStartResult> => {
    if (session.isOpen()) return { ok: false, reason: 'already-open' }
    const checked = checkEventName(name)
    if (!checked.ok) return { ok: false, reason: 'invalid-name' }
    // No template imported for this mode: the sheet is plain white 1844×1240 (PRD §6.1), so an event
    // can start right away; the photos still go into the standard boxes.
    const template = await readTemplate(deps.userData, mode)

    // The TV first: with no TV the event does not start and no folder appears (RF04).
    const opened = tv.open()
    if (!opened.ok) {
      // A TV that went away right after opening leaves a hidden window; do not keep it around.
      if (opened.state.tv.kind !== 'closed') tv.close()
      return { ok: false, reason: opened.reason }
    }
    const folder = join(deps.desktop, checked.name)
    try {
      // Reuses an existing folder and keeps its files (RF02).
      await mkdir(folder, { recursive: true })
    } catch {
      tv.close()
      return { ok: false, reason: 'folder-failed' }
    }
    const { layouts } = await readConfig(deps.userData)
    // The template's own black boxes, when it has one per slot, are the fixed boxes (DESIGN §6).
    const boxes = template ? await detectTemplateBoxes(template.bytes, mode).catch(() => null) : null
    return { ok: true, session: session.start({ name: checked.name, mode, folder, slots: layouts[mode], template: template?.bytes ?? null, boxes }) }
  })

  handleInvoke(IPC_CHANNELS.eventEnd, () => {
    tv.close()
    return session.end()
  })

  // The TV window gone for any reason ends the event: the round lives with the camera.
  tv.onChange((state) => {
    if (state.tv.kind === 'closed' && session.isOpen()) session.end()
  })

  handleInvoke(IPC_CHANNELS.sessionGetState, () => session.state())
  handleInvoke(IPC_CHANNELS.sessionGetPreview, () => session.preview())
  handleInvoke(IPC_CHANNELS.sessionGetPhoto, ({ index }) => session.photo(index))
  handleInvoke(IPC_CHANNELS.sessionSetTimer, ({ timer }) => session.setTimer(timer))
  handleInvoke(IPC_CHANNELS.sessionSetCopies, ({ copies }) => session.setCopies(copies))
  handleInvoke(IPC_CHANNELS.sessionSetFraming, ({ slotId, framing }) => session.setFraming(slotId, framing))
  handleInvoke(IPC_CHANNELS.sessionCancel, () => session.cancel())
  handleInvoke(IPC_CHANNELS.sessionPrint, () => session.print())
  handleInvoke(IPC_CHANNELS.sessionReprint, () => session.reprint())
  handleInvoke(IPC_CHANNELS.sessionNewRound, () => session.newRound())

  handleSend(IPC_CHANNELS.sessionPhoto, ({ index, jpeg }, event) => {
    if (!deps.isGuestWindow(event.sender)) return
    session.addPhoto(index, jpeg)
  })

  // The laptop's shutter runs the TV's own path, timer included (DESIGN §4).
  handleSend(IPC_CHANNELS.sessionRequestShutter, (_payload, event) => {
    if (deps.isGuestWindow(event.sender) || !session.isOpen()) return
    const guest = deps.guestContents()
    if (guest) sendTo(guest, IPC_CHANNELS.sessionShutter, {})
  })
}

/** The IPC schema types arrays as mutable; the config keeps them readonly. */
function mutableLayouts(layouts: Layouts) {
  return { 'two-strips': [...layouts['two-strips']], 'one-strip': [...layouts['one-strip']] }
}

/** Pushes every session change to both windows. */
export function broadcastSession(state: SessionState): void {
  broadcast(IPC_CHANNELS.sessionState, state)
}
