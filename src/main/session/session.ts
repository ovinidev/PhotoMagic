import type { EventSession, PrintFailureReason, RoundPhase, SessionPreview, SessionState, Timer } from '@shared/ipc'
import { clampFraming, isDefaultFraming, type Framing, type PhotoIndex, type PrintMode, type Slot } from '@shared/layout'
import { clampCopies } from '@shared/round'
import type { SheetInput, SheetOutput } from '../compose/renderSheet'
import { ticketFor, type Printer } from '../print'

/**
 * The event and its round, in main's memory (DESIGN §2, §9). The three captures never touch the
 * disk: the only file is the montage, written at `Imprimir`. If the process dies before that, the
 * round is lost, by design (PRD §4.10).
 */

export type OpenEvent = {
  name: string
  mode: PrintMode
  /** `Desktop\<name>`, already created. */
  folder: string
  slots: readonly Slot[]
  template: Uint8Array | null
}

export type SessionDeps = {
  render: (input: SheetInput, output: SheetOutput) => Promise<Uint8Array>
  /** Writes the montage into the folder under a free `HH-mm-ss.jpg` name; returns the file name and path. */
  saveMontage: (folder: string, jpeg: Uint8Array) => Promise<{ fileName: string; path: string }>
  printer: Printer
  onChange: (state: SessionState) => void
  /** Reports a preview that could not be composed; the round keeps going. */
  onError?: (error: unknown) => void
}

export type Session = {
  state: () => SessionState
  preview: () => SessionPreview
  isOpen: () => boolean
  start: (event: OpenEvent) => SessionState
  end: () => SessionState
  addPhoto: (index: PhotoIndex, jpeg: Uint8Array) => SessionState
  setTimer: (timer: Timer) => SessionState
  setCopies: (copies: number) => SessionState
  /** RF09: frames one filled slot; refused once the montage is saved or while printing. */
  setFraming: (slotId: string, framing: Framing) => SessionState
  cancel: () => SessionState
  print: () => Promise<SessionState>
  reprint: () => Promise<SessionState>
  newRound: () => SessionState
  /** Resolves when every preview scheduled so far is composed. For tests and orderly shutdown. */
  settled: () => Promise<void>
}

type Round = {
  photos: Map<PhotoIndex, Uint8Array>
  /** Framing per slot id; each slot has its own, even when two slots share a capture (RF09). */
  framings: Map<string, Framing>
  phase: RoundPhase
  /** Montage already written for this round, kept across a failed send (RF13). */
  saved: { fileName: string; path: string } | null
}

const freshRound = (): Round => ({ photos: new Map(), framings: new Map(), phase: { kind: 'capturing' }, saved: null })

export function createSession(deps: SessionDeps): Session {
  let event: OpenEvent | null = null
  let round = freshRound()
  let timer: Timer = 0
  let copies = 1
  let preview: SessionPreview = { revision: 0, jpeg: null }
  /** Identifies the event and round a preview job belongs to; a stale job is dropped. */
  let generation = 0
  let queue: Promise<void> = Promise.resolve()
  /** Generation of a preview job queued but not started yet; another request just reuses it. */
  let pendingFor: number | null = null

  const state = (): SessionState => {
    if (!event) return { kind: 'idle' }
    const open: EventSession = {
      kind: 'event',
      name: event.name,
      mode: event.mode,
      timer,
      copies,
      taken: round.photos.size,
      previewRevision: preview.revision,
      slots: [...event.slots],
      framings: Object.fromEntries(round.framings),
      phase: round.phase,
    }
    return open
  }

  const notify = () => {
    const current = state()
    deps.onChange(current)
    return current
  }

  const sheetInput = (open: OpenEvent, current: Round): SheetInput => ({
    template: open.template,
    slots: open.slots,
    photos: Object.fromEntries(current.photos),
    framings: Object.fromEntries(current.framings),
  })

  /**
   * Composes the preview of the current round after the jobs already queued. The input is read when
   * the job starts, so a burst of framing changes during a drag costs one composition, not one each.
   */
  const schedulePreview = () => {
    if (!event || pendingFor === generation) return
    const job = generation
    pendingFor = job
    queue = queue
      .then(async () => {
        if (pendingFor === job) pendingFor = null
        if (job !== generation || !event) return
        const jpeg = await deps.render(sheetInput(event, round), { kind: 'preview' })
        if (job !== generation) return
        preview = { revision: preview.revision + 1, jpeg }
        notify()
      })
      .catch((error: unknown) => deps.onError?.(error))
  }

  const resetRound = () => {
    generation++
    round = freshRound()
    schedulePreview()
  }

  const fail = (reason: PrintFailureReason, detail: string): void => {
    round.phase = { kind: 'print-failed', reason, detail, fileName: round.saved?.fileName ?? null }
  }

  /** Sends the saved montage; leaves the phase at `printed` or `print-failed`. */
  const send = async (open: OpenEvent, saved: { fileName: string; path: string }) => {
    try {
      const result = await deps.printer.print(ticketFor(saved.path, copies, open.mode))
      if (result.ok) round.phase = { kind: 'printed', fileName: saved.fileName }
      else fail(result.reason, result.detail)
    } catch (error) {
      fail('failed', error instanceof Error ? error.message : String(error))
    }
  }

  return {
    state,
    preview: () => preview,
    isOpen: () => event !== null,

    start: (next) => {
      event = next
      copies = 1
      preview = { revision: preview.revision, jpeg: null }
      resetRound()
      return notify()
    },

    end: () => {
      event = null
      generation++
      round = freshRound()
      preview = { revision: preview.revision, jpeg: null }
      return notify()
    },

    addPhoto: (index, jpeg) => {
      // Only the next photo of a round still capturing: a double tap or a late shutter adds nothing (RF06).
      if (!event || round.phase.kind !== 'capturing' || index !== round.photos.size + 1) return state()
      round.photos.set(index, jpeg)
      if (round.photos.size === 3) round.phase = { kind: 'review' }
      schedulePreview()
      return notify()
    },

    setTimer: (next) => {
      if (!event) return state()
      timer = next
      return notify()
    },

    setCopies: (next) => {
      if (!event) return state()
      copies = clampCopies(next)
      return notify()
    },

    setFraming: (slotId, framing) => {
      const slot = event?.slots.find((candidate) => candidate.id === slotId)
      const phase = round.phase.kind
      if (!event || !slot || slot.photo === null || !round.photos.has(slot.photo)) return state()
      if (round.saved || (phase !== 'capturing' && phase !== 'review' && phase !== 'print-failed')) return state()
      const next = clampFraming(framing)
      if (isDefaultFraming(next)) round.framings.delete(slotId)
      else round.framings.set(slotId, next)
      schedulePreview()
      return notify()
    },

    cancel: () => {
      if (!event || round.phase.kind === 'printing') return state()
      copies = 1
      resetRound()
      return notify()
    },

    print: async () => {
      const open = event
      if (!open || (round.phase.kind !== 'review' && round.phase.kind !== 'print-failed')) return state()
      const current = round
      current.phase = { kind: 'printing' }
      notify()

      if (!current.saved) {
        try {
          const jpeg = await deps.render(sheetInput(open, current), { kind: 'montage' })
          current.saved = await deps.saveMontage(open.folder, jpeg)
        } catch (error) {
          // Nothing was written, so nothing is announced as printed (DESIGN §10).
          if (round === current) fail('save-failed', error instanceof Error ? error.message : String(error))
          return notify()
        }
      }
      if (round !== current) return state()
      await send(open, current.saved)
      return round === current ? notify() : state()
    },

    reprint: async () => {
      const open = event
      const current = round
      if (!open || current.phase.kind !== 'printed' || !current.saved) return state()
      current.phase = { kind: 'printing' }
      notify()
      await send(open, current.saved)
      return round === current ? notify() : state()
    },

    newRound: () => {
      if (!event || round.phase.kind !== 'printed') return state()
      copies = 1
      resetRound()
      return notify()
    },

    settled: () => queue,
  }
}
