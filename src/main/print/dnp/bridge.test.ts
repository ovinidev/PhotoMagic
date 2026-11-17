import { EventEmitter } from 'node:events'
import { PassThrough } from 'node:stream'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createHelperBridge, type HelperProcess } from './bridge'
import { RESPONSE_PREFIX } from './protocol'

/** A fake helper: records stdin lines and lets the test answer on stdout or exit. */
function fakeHelper() {
  const events = new EventEmitter()
  const stdout = new PassThrough()
  const lines: Array<Record<string, unknown>> = []
  const process: HelperProcess & { killed: boolean } = {
    killed: false,
    stdin: { write: (chunk: string) => lines.push(JSON.parse(chunk)) },
    stdout,
    once: (event, listener) => events.once(event, listener),
    kill: () => {
      process.killed = true
    },
  }
  return {
    process,
    lines,
    answer: (payload: Record<string, unknown>) => stdout.write(`${RESPONSE_PREFIX}${JSON.stringify(payload)}\n`),
    noise: (text: string) => stdout.write(`${text}\n`),
    exit: (code: number) => events.emit('exit', code),
  }
}

afterEach(() => {
  vi.useRealTimers()
})

describe('createHelperBridge', () => {
  it('starts the helper once and sends one request at a time, matching answers by id', async () => {
    const helper = fakeHelper()
    const spawn = vi.fn(() => helper.process)
    const bridge = createHelperBridge({ spawn, timeoutMs: () => 1_000 })
    const first = bridge.request({ action: 'list' })
    const second = bridge.request({ action: 'capabilities', printer: 'DNP DS-RX1' })
    expect(helper.lines).toEqual([{ id: 1, action: 'list' }])
    helper.noise('WARNING: something PowerShell printed')
    helper.answer({ id: 1, ok: true, printers: [] })
    await expect(first).resolves.toEqual({ id: 1, ok: true, printers: [] })
    expect(helper.lines).toEqual([
      { id: 1, action: 'list' },
      { id: 2, action: 'capabilities', printer: 'DNP DS-RX1' },
    ])
    helper.answer({ id: 2, ok: true, features: [] })
    await expect(second).resolves.toEqual({ id: 2, ok: true, features: [] })
    expect(spawn).toHaveBeenCalledTimes(1)
  })

  it('rejects what is pending when the helper exits, and restarts on the next request', async () => {
    const helpers = [fakeHelper(), fakeHelper()]
    const spawn = vi.fn(() => helpers[spawn.mock.calls.length - 1]!.process)
    const bridge = createHelperBridge({ spawn, timeoutMs: () => 1_000 })
    const lost = bridge.request({ action: 'list' })
    helpers[0]!.exit(1)
    await expect(lost).rejects.toThrow('print helper exited (1)')
    const next = bridge.request({ action: 'list' })
    helpers[1]!.answer({ id: 2, ok: true, printers: [] })
    await expect(next).resolves.toMatchObject({ ok: true })
    expect(spawn).toHaveBeenCalledTimes(2)
  })

  it('kills a helper that does not answer in time', async () => {
    vi.useFakeTimers()
    const helper = fakeHelper()
    const bridge = createHelperBridge({ spawn: () => helper.process, timeoutMs: (request) => (request.action === 'print' ? 60_000 : 5_000) })
    const status = bridge.request({ action: 'list' })
    vi.advanceTimersByTime(5_000)
    await expect(status).rejects.toThrow('did not answer list in time')
    expect(helper.process.killed).toBe(true)
  })

  it('rejects instead of throwing when the helper cannot be spawned', async () => {
    const bridge = createHelperBridge({
      spawn: () => {
        throw new Error('ENOENT powershell.exe')
      },
      timeoutMs: () => 1_000,
    })
    await expect(bridge.request({ action: 'list' })).rejects.toThrow('ENOENT')
  })
})
