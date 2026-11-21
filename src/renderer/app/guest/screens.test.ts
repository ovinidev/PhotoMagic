import { describe, expect, it } from 'vitest'
import type { EventSession, RoundPhase } from '@shared/ipc'
import { guestScreen } from './screens'

const session = (phase: RoundPhase) => ({ kind: 'event', phase }) as EventSession

describe('guestScreen', () => {
  it('shows the camera with no event and while capturing', () => {
    expect(guestScreen(null)).toBe('camera')
    expect(guestScreen(session({ kind: 'capturing' }))).toBe('camera')
  })

  it('shows the print screen from review to the end of the round', () => {
    expect(guestScreen(session({ kind: 'review' }))).toBe('print')
    expect(guestScreen(session({ kind: 'printing', step: 'sending' }))).toBe('print')
    expect(guestScreen(session({ kind: 'printed', fileName: '21-45-08.jpg' }))).toBe('print')
    expect(guestScreen(session({ kind: 'print-failed', reason: 'offline', detail: '', fileName: null }))).toBe('print')
  })
})
