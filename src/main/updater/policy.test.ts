import { describe, expect, it } from 'vitest'
import { nextUpdateStatus, shouldCheckForUpdates } from './policy'

const installed = { packaged: true, e2e: false, eventOpen: false, online: true }

describe('shouldCheckForUpdates', () => {
  it('checks in an installed build, online, with no event in progress', () => {
    expect(shouldCheckForUpdates(installed)).toBe(true)
  })

  it('never checks with an event in progress', () => {
    expect(shouldCheckForUpdates({ ...installed, eventOpen: true })).toBe(false)
  })

  it('never checks offline, so startup does not wait on the network', () => {
    expect(shouldCheckForUpdates({ ...installed, online: false })).toBe(false)
  })

  it('never checks in dev or under E2E', () => {
    expect(shouldCheckForUpdates({ ...installed, packaged: false })).toBe(false)
    expect(shouldCheckForUpdates({ ...installed, e2e: true })).toBe(false)
  })
})

describe('nextUpdateStatus', () => {
  it('follows a download from available to ready', () => {
    let status = nextUpdateStatus({ kind: 'idle' }, { kind: 'available', version: '1.2.0' })
    expect(status).toEqual({ kind: 'downloading', version: '1.2.0', percent: 0 })
    status = nextUpdateStatus(status, { kind: 'progress', percent: 41.6 })
    expect(status).toEqual({ kind: 'downloading', version: '1.2.0', percent: 42 })
    status = nextUpdateStatus(status, { kind: 'downloaded', version: '1.2.0' })
    expect(status).toEqual({ kind: 'ready', version: '1.2.0' })
  })

  it('goes back to idle on an error or when there is no update', () => {
    const downloading = { kind: 'downloading', version: '1.2.0', percent: 10 } as const
    expect(nextUpdateStatus(downloading, { kind: 'error' })).toEqual({ kind: 'idle' })
    expect(nextUpdateStatus({ kind: 'idle' }, { kind: 'not-available' })).toEqual({ kind: 'idle' })
  })

  it('ignores progress without a known download', () => {
    expect(nextUpdateStatus({ kind: 'idle' }, { kind: 'progress', percent: 50 })).toEqual({ kind: 'idle' })
  })

  it('keeps a downloaded update ready for the next quit, even after an error', () => {
    const ready = { kind: 'ready', version: '1.2.0' } as const
    expect(nextUpdateStatus(ready, { kind: 'error' })).toBe(ready)
  })
})
