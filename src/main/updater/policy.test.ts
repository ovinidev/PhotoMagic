import { describe, expect, it } from 'vitest'
import { shouldCheckForUpdates } from './policy'

describe('shouldCheckForUpdates', () => {
  it('checks in an installed build with no event open', () => {
    expect(shouldCheckForUpdates({ packaged: true, e2e: false, eventOpen: false })).toBe(true)
  })

  it('never checks in dev, under E2E or with an event open', () => {
    expect(shouldCheckForUpdates({ packaged: false, e2e: false, eventOpen: false })).toBe(false)
    expect(shouldCheckForUpdates({ packaged: true, e2e: true, eventOpen: false })).toBe(false)
    expect(shouldCheckForUpdates({ packaged: true, e2e: false, eventOpen: true })).toBe(false)
  })
})
