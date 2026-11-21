import { describe, expect, it } from 'vitest'
import type { RoundPhase } from '@shared/ipc'
import { printProgress } from './printProgress'

describe('printProgress (print status → print animation)', () => {
  it('shows no job before Imprimir', () => {
    expect(printProgress({ kind: 'capturing' })).toEqual({ kind: 'idle' })
    expect(printProgress({ kind: 'review' })).toEqual({ kind: 'idle' })
  })

  it('saving keeps the photo inside the printer at a third of the bar', () => {
    expect(printProgress({ kind: 'printing', step: 'saving' })).toEqual({ kind: 'job', stage: 'saving', value: 1 / 3, active: true, eject: 'inside' })
  })

  it('sending feeds the photo part way out at two thirds, still running', () => {
    expect(printProgress({ kind: 'printing', step: 'sending' })).toEqual({ kind: 'job', stage: 'sending', value: 2 / 3, active: true, eject: 'feeding' })
  })

  it('only printed fills the bar and ejects the photo', () => {
    expect(printProgress({ kind: 'printed', fileName: '21-45-08.jpg' })).toEqual({ kind: 'job', stage: 'done', value: 1, active: false, eject: 'out' })
  })

  it('never reports completion for a step in flight or a failure', () => {
    const phases: RoundPhase[] = [
      { kind: 'printing', step: 'saving' },
      { kind: 'printing', step: 'sending' },
      { kind: 'print-failed', reason: 'no-paper', detail: 'simulated', fileName: '21-45-08.jpg' },
      { kind: 'print-failed', reason: 'save-failed', detail: 'disk full', fileName: null },
    ]
    for (const phase of phases) {
      const progress = printProgress(phase)
      if (progress.kind === 'job') expect(progress.value).toBeLessThan(1)
      expect(progress).not.toMatchObject({ eject: 'out' })
    }
  })

  it('hands a failure back to the existing error screen', () => {
    expect(printProgress({ kind: 'print-failed', reason: 'offline', detail: '', fileName: '21-45-08.jpg' })).toEqual({ kind: 'idle' })
  })
})
