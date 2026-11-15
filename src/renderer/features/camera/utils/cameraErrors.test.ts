import { describe, expect, it } from 'vitest'
import { classifyCameraError } from './cameraErrors'

describe('classifyCameraError', () => {
  it.each([
    ['NotAllowedError', 'permission-denied'],
    ['SecurityError', 'permission-denied'],
    ['NotFoundError', 'not-found'],
    ['OverconstrainedError', 'not-found'],
    ['NotReadableError', 'in-use'],
    ['TrackStartError', 'in-use'],
    ['TypeError', 'unknown'],
  ])('maps %s to %s', (name, reason) => {
    expect(classifyCameraError(new DOMException('x', name))).toBe(reason)
  })

  it('treats anything that is not an error as unknown', () => {
    expect(classifyCameraError(undefined)).toBe('unknown')
    expect(classifyCameraError('NotAllowedError')).toBe('unknown')
  })
})
