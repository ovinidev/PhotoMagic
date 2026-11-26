import type { RoundPhase } from '@shared/ipc'

export type PrintProgress =
  /** Not printing: the plain sheet preview (`review`, or a failure with the existing error copy). */
  | { kind: 'idle' }
  /** A job in flight or done: the TV shows only the line for its stage, with no animation. */
  | { kind: 'job'; stage: 'saving' | 'sending' | 'done' }

/**
 * Maps the round phase main reports (DESIGN §10, §14) to the TV print status. `done` is only ever
 * `printed`; a failure falls back to the existing error screen.
 */
export function printProgress(phase: RoundPhase): PrintProgress {
  switch (phase.kind) {
    case 'printing':
      return { kind: 'job', stage: phase.step === 'saving' ? 'saving' : 'sending' }
    case 'printed':
      return { kind: 'job', stage: 'done' }
    case 'capturing':
    case 'review':
    case 'print-failed':
      return { kind: 'idle' }
  }
}
