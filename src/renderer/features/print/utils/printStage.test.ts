import { describe, expect, it } from 'vitest'
import { printStage } from './printStage'

describe('printStage (print status → TV status line)', () => {
  it('has no stage before Imprimir or after a failure', () => {
    expect(printStage({ kind: 'capturing' })).toBeNull()
    expect(printStage({ kind: 'review' })).toBeNull()
    expect(printStage({ kind: 'print-failed', reason: 'offline', detail: '', fileName: '21-45-08.jpg' })).toBeNull()
  })

  it('follows the real job steps', () => {
    expect(printStage({ kind: 'printing', step: 'saving' })).toBe('saving')
    expect(printStage({ kind: 'printing', step: 'sending' })).toBe('sending')
  })

  it('is done only once printed', () => {
    expect(printStage({ kind: 'printed', fileName: '21-45-08.jpg' })).toBe('done')
  })
})
