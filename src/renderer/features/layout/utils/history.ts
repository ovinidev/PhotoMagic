import type { Slot } from '@shared/layout'

/**
 * Undo/Redo of one layout in the editor. Each committed change (a released gesture, a confirmed
 * number, a photo choice, `Restaurar padrão`) is one step. Gestures in progress are not steps.
 */
export type History = {
  past: ReadonlyArray<readonly Slot[]>
  present: readonly Slot[]
  future: ReadonlyArray<readonly Slot[]>
}

/** Enough for an editing session; the oldest step is dropped past this. */
export const HISTORY_LIMIT = 100

export function startHistory(present: readonly Slot[]): History {
  return { past: [], present, future: [] }
}

/** A new step. Equal content is not a step, so a click without a drag does not fill Undo. */
export function commit(history: History, next: readonly Slot[]): History {
  if (sameSlots(history.present, next)) return history
  return { past: [...history.past, history.present].slice(-HISTORY_LIMIT), present: next, future: [] }
}

export function undo(history: History): History {
  const previous = history.past.at(-1)
  if (!previous) return history
  return { past: history.past.slice(0, -1), present: previous, future: [history.present, ...history.future] }
}

export function redo(history: History): History {
  const [next, ...rest] = history.future
  if (!next) return history
  return { past: [...history.past, history.present], present: next, future: rest }
}

export const canUndo = (history: History) => history.past.length > 0
export const canRedo = (history: History) => history.future.length > 0

export function sameSlots(a: readonly Slot[], b: readonly Slot[]): boolean {
  return (
    a.length === b.length &&
    a.every((slot, i) => {
      const other = b[i]!
      return (
        slot.id === other.id &&
        slot.photo === other.photo &&
        slot.left === other.left &&
        slot.top === other.top &&
        slot.width === other.width &&
        slot.height === other.height &&
        slot.angle === other.angle
      )
    })
  )
}

/** The layout with one slot replaced. */
export function replaceSlot(slots: readonly Slot[], slot: Slot): Slot[] {
  return slots.map((current) => (current.id === slot.id ? slot : current))
}
