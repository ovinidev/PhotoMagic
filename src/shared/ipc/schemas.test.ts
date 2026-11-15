import { describe, expect, it } from 'vitest'
import {
  EVENT_CONTRACT,
  INVOKE_CONTRACT,
  IPC_CHANNELS,
  SEND_CONTRACT,
  appGetVersionInputSchema,
  appVersionSchema,
  cameraStatusSchema,
  displayStateSchema,
  tvOpenInputSchema,
  tvOpenResultSchema,
} from './index'

const tv = { id: 2, primary: false, x: 1920, y: 0, width: 1080, height: 1920 }

describe('IPC contract', () => {
  it('keeps channel names stable and namespaced', () => {
    expect(IPC_CHANNELS.appGetVersion).toBe('app:get-version')
    for (const name of Object.values(IPC_CHANNELS)) {
      expect(name).toMatch(/^[a-z]+:[a-z]+(?:-[a-z]+)*$/)
    }
  })

  it('gives every channel exactly one contract: invoke, send or event', () => {
    const contracted = [...Object.keys(INVOKE_CONTRACT), ...Object.keys(SEND_CONTRACT), ...Object.keys(EVENT_CONTRACT)]
    expect(contracted.sort()).toEqual(Object.values(IPC_CHANNELS).sort())
    expect(new Set(contracted).size).toBe(contracted.length)
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

  it('display state carries the TV choice and the TV window state', () => {
    const state = { guest: { kind: 'portrait', display: tv }, tv: { kind: 'open', display: tv } }
    expect(displayStateSchema.parse(state)).toEqual(state)
    expect(displayStateSchema.safeParse({ guest: { kind: 'missing' }, tv: { kind: 'detached', reason: 'missing' } }).success).toBe(true)
    expect(displayStateSchema.safeParse({ guest: { kind: 'missing', display: tv }, tv: { kind: 'closed' } }).success).toBe(false)
    expect(displayStateSchema.safeParse({ guest: { kind: 'portrait', display: { ...tv, width: 0 } }, tv: { kind: 'closed' } }).success).toBe(false)
    expect(displayStateSchema.safeParse({ guest: { kind: 'missing' }, tv: { kind: 'detached', reason: 'gone' } }).success).toBe(false)
  })

  it('tv:open takes the landscape confirmation and says why it could not open', () => {
    expect(tvOpenInputSchema.safeParse({ allowLandscape: true }).success).toBe(true)
    expect(tvOpenInputSchema.safeParse({}).success).toBe(false)
    const state = { guest: { kind: 'missing' }, tv: { kind: 'closed' } }
    expect(tvOpenResultSchema.safeParse({ ok: false, reason: 'missing', state }).success).toBe(true)
    expect(tvOpenResultSchema.safeParse({ ok: true, reason: 'missing', state }).success).toBe(false)
  })

  it('camera status accepts each state and rejects unknown reasons or bad sizes', () => {
    expect(cameraStatusSchema.safeParse({ kind: 'idle' }).success).toBe(true)
    expect(cameraStatusSchema.safeParse({ kind: 'live', label: 'MX Brio', width: 3840, height: 2160 }).success).toBe(true)
    expect(cameraStatusSchema.safeParse({ kind: 'error', reason: 'permission-denied' }).success).toBe(true)
    expect(cameraStatusSchema.safeParse({ kind: 'error', reason: 'on-fire' }).success).toBe(false)
    expect(cameraStatusSchema.safeParse({ kind: 'live', label: 'x', width: 0, height: 0 }).success).toBe(true)
    expect(cameraStatusSchema.safeParse({ kind: 'live', label: 'x', width: -1, height: 1 }).success).toBe(false)
    expect(cameraStatusSchema.safeParse({ kind: 'live', label: 'x', width: 1.5, height: 1 }).success).toBe(false)
    expect(cameraStatusSchema.safeParse({ kind: 'live', label: 'x'.repeat(257), width: 1, height: 1 }).success).toBe(false)
  })
})
