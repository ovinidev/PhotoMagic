import type { RoundPhase } from '@shared/ipc'

/**
 * How far the photo sits out of the printer slot: still inside, `feeding` (part of it out while the
 * printer holds the job) or fully `out`. Under `prefers-reduced-motion` only `out` is shown, still.
 */
export type EjectPosition = 'inside' | 'feeding' | 'out'

export type PrintProgress =
  /** Not printing: the plain sheet preview (`review`, or a failure with the existing error copy). */
  | { kind: 'idle' }
  /**
   * A job in flight or done. `value` is the share of the real job stages reached (0–1): it moves
   * only when main reports a new step, never on a timer. `active` means a stage is still running.
   */
  | { kind: 'job'; stage: 'saving' | 'sending' | 'done'; value: number; active: boolean; eject: EjectPosition }

/** The print job, in order: compose and write the JPG, hand it to the printer, the printer's answer. */
const STAGES = 3

/**
 * Maps the round phase main reports (DESIGN §10, §14) to the print animation. Completion is only
 * ever `printed`: a step in flight caps below 100%, and a failure falls back to the existing error
 * screen instead of a full bar.
 */
export function printProgress(phase: RoundPhase): PrintProgress {
  switch (phase.kind) {
    case 'printing':
      return phase.step === 'saving'
        ? { kind: 'job', stage: 'saving', value: 1 / STAGES, active: true, eject: 'inside' }
        : { kind: 'job', stage: 'sending', value: 2 / STAGES, active: true, eject: 'feeding' }
    case 'printed':
      return { kind: 'job', stage: 'done', value: 1, active: false, eject: 'out' }
    case 'capturing':
    case 'review':
    case 'print-failed':
      return { kind: 'idle' }
  }
}
