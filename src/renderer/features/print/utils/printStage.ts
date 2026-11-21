import type { RoundPhase } from '@shared/ipc'

/** The print job stage shown on the TV: compose and write the JPG, hand it to the printer, printed. */
export type PrintStage = 'saving' | 'sending' | 'done'

/**
 * Maps the round phase main reports (DESIGN §10, §14) to the static print status line. Only
 * `printed` is `done`; a failure keeps the existing error copy, so it has no stage.
 */
export function printStage(phase: RoundPhase): PrintStage | null {
  switch (phase.kind) {
    case 'printing':
      return phase.step
    case 'printed':
      return 'done'
    case 'capturing':
    case 'review':
    case 'print-failed':
      return null
  }
}
