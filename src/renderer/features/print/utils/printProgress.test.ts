import { describe, expect, it } from 'vitest'
import type { RoundPhase } from '@shared/ipc'
import { printProgress } from './printProgress'

describe('printProgress (print status → TV status line)', () => {
  it('shows no job before Imprimir', () => {
    expect(printProgress({ kind: 'capturing' })).toEqual({ kind: 'idle' })
    expect(printProgress({ kind: 'review' })).toEqual({ kind: 'idle' })
  })

  it('maps each job step to its stage', () => {
    expect(printProgress({ kind: 'printing', step: 'saving' })).toEqual({ kind: 'job', stage: 'saving' })
    expect(printProgress({ kind: 'printing', step: 'sending' })).toEqual({ kind: 'job', stage: 'sending' })
    expect(printProgress({ kind: 'printed', fileName: '21-45-08.jpg' })).toEqual({ kind: 'job', stage: 'done' })
  })

  it('never reports done for a step in flight or a failure', () => {
    const phases: RoundPhase[] = [
      { kind: 'printing', step: 'saving' },
      { kind: 'printing', step: 'sending' },
      { kind: 'print-failed', reason: 'no-paper', detail: 'simulated', fileName: '21-45-08.jpg' },
      { kind: 'print-failed', reason: 'save-failed', detail: 'disk full', fileName: null },
    ]
    for (const phase of phases) expect(printProgress(phase)).not.toMatchObject({ stage: 'done' })
  })

  it('hands a failure back to the existing error screen', () => {
    expect(printProgress({ kind: 'print-failed', reason: 'offline', detail: '', fileName: '21-45-08.jpg' })).toEqual({ kind: 'idle' })
  })
})
