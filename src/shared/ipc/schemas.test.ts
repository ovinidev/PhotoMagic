import { describe, expect, it } from 'vitest'
import { INVOKE_CONTRACT, IPC_CHANNELS, appGetVersionInputSchema, appVersionSchema } from './index'

describe('IPC contract', () => {
  it('keeps channel names stable and namespaced', () => {
    expect(IPC_CHANNELS.appGetVersion).toBe('app:get-version')
    for (const name of Object.values(IPC_CHANNELS)) {
      expect(name).toMatch(/^[a-z]+:[a-z]+(?:-[a-z]+)*$/)
    }
  })

  it('has a schema pair for every invoke channel', () => {
    expect(Object.keys(INVOKE_CONTRACT).sort()).toEqual(Object.values(IPC_CHANNELS).sort())
  })

  it('app:get-version takes no input', () => {
    expect(appGetVersionInputSchema.safeParse(undefined).success).toBe(true)
    expect(appGetVersionInputSchema.safeParse({}).success).toBe(false)
  })

  it('app:get-version accepts a valid payload and rejects malformed ones', () => {
    expect(appVersionSchema.parse({ version: '0.1.0', e2e: false })).toEqual({ version: '0.1.0', e2e: false })
    expect(appVersionSchema.safeParse({ version: '1.2.3-beta.1', e2e: true }).success).toBe(true)
    expect(appVersionSchema.safeParse({ version: '', e2e: false }).success).toBe(false)
    expect(appVersionSchema.safeParse({ version: 'latest', e2e: false }).success).toBe(false)
    expect(appVersionSchema.safeParse({ version: '0.1.0' }).success).toBe(false)
    expect(appVersionSchema.safeParse({ version: '0.1.0', e2e: false, extra: 1 }).success).toBe(false)
  })
})
