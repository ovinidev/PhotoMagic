import { describe, expect, it } from 'vitest'
import type { EventSession, RoundPhase } from '@shared/ipc'
import { guestScreen, transitionClass, transitionDirection } from './screens'

const session = (phase: RoundPhase) => ({ kind: 'event', phase }) as EventSession

describe('guestScreen', () => {
  it('shows the camera with no event and while capturing', () => {
    expect(guestScreen(null)).toBe('camera')
    expect(guestScreen(session({ kind: 'capturing' }))).toBe('camera')
  })

  it('shows the print screen from review to the end of the round', () => {
    expect(guestScreen(session({ kind: 'review' }))).toBe('print')
    expect(guestScreen(session({ kind: 'printing' }))).toBe('print')
    expect(guestScreen(session({ kind: 'printed', fileName: '21-45-08.jpg' }))).toBe('print')
    expect(guestScreen(session({ kind: 'print-failed', reason: 'offline', detail: '', fileName: null }))).toBe('print')
  })
})

describe('transitionDirection', () => {
  it('is forward from the camera to the print screen', () => {
    expect(transitionDirection('camera', 'print')).toBe('forward')
  })

  it('is back from the print screen to the camera', () => {
    expect(transitionDirection('print', 'camera')).toBe('back')
  })

  it('is none when the screen does not change', () => {
    expect(transitionDirection('camera', 'camera')).toBe('none')
    expect(transitionDirection('print', 'print')).toBe('none')
  })
})

describe('transitionClass', () => {
  it('zooms the entering screen in on forward and slides the leaving one out on back', () => {
    expect(transitionClass('forward', 'entering')).toBe('guest-screen-enter-forward')
    expect(transitionClass('back', 'leaving')).toBe('guest-screen-exit-back')
  })

  it('does not animate the other cases', () => {
    expect(transitionClass('forward', 'leaving')).toBeUndefined()
    expect(transitionClass('back', 'entering')).toBeUndefined()
    expect(transitionClass('none', 'entering')).toBeUndefined()
  })
})
