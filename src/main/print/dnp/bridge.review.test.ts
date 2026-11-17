import { EventEmitter } from 'node:events'
import { PassThrough } from 'node:stream'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createHelperBridge, type HelperProcess } from './bridge'
import { RESPONSE_PREFIX } from './protocol'

/** A fake helper that, like dnp-helper.ps1, reads one request at a time. */
function sequentialHelper() {
  const events = new EventEmitter()
  const stdout = new PassThrough()
  const lines: Array<{ id: number; action: string }> = []
  const process: HelperProcess & { killed: boolean } = {
    killed: false,
    stdin: { write: (chunk: string) => lines.push(JSON.parse(chunk)) },
    stdout,
    once: (event, listener) => events.once(event, listener),
    kill: () => {
      process.killed = true
      queueMicrotask(() => events.emit('exit', 1))
    },
  }
  return { process, lines, answer: (payload: Record<string, unknown>) => stdout.write(`${RESPONSE_PREFIX}${JSON.stringify(payload)}\n`) }
}

afterEach(() => vi.useRealTimers())

describe('createHelperBridge with a sequential helper', () => {
  it('does not time out a status read queued behind a slow print, nor kill the print', async () => {
    vi.useFakeTimers()
    const helper = sequentialHelper()
    const bridge = createHelperBridge({ spawn: () => helper.process, timeoutMs: (r) => (r.action === 'print' ? 120_000 : 20_000) })
    const print = bridge.request({ action: 'print', printer: 'DS-RX1', jpegPath: 'C:\\a.jpg', copies: 10, documentName: 'x', settings: [] })
    const outcomes: string[] = []
    void print.then(() => outcomes.push('print ok'), (e: Error) => outcomes.push(`print: ${e.message}`))
    await vi.advanceTimersByTimeAsync(5_000)
    // The printer monitor polls while the helper is still spooling 10 copies.
    const status = bridge.request({ action: 'list' })
    void status.then(() => outcomes.push('list ok'), (e: Error) => outcomes.push(`list: ${e.message}`))
    await vi.advanceTimersByTimeAsync(25_000)
    // The helper finishes the print at 30 s, then answers the list.
    helper.answer({ id: 1, ok: true, page: { width: 400, height: 600 } })
    helper.answer({ id: 2, ok: true, printers: [] })
    await vi.advanceTimersByTimeAsync(1)
    expect(outcomes).toEqual(['print ok', 'list ok'])
    expect(helper.process.killed).toBe(false)
  })

  it('fails a request at once when its helper is gone, instead of at its own timeout', async () => {
    vi.useFakeTimers()
    const helper = sequentialHelper()
    const bridge = createHelperBridge({ spawn: () => helper.process, timeoutMs: (r) => (r.action === 'print' ? 120_000 : 5_000) })
    const status = bridge.request({ action: 'list' })
    status.catch(() => {})
    const print = bridge.request({ action: 'print', printer: 'DS-RX1', jpegPath: 'C:\\a.jpg', copies: 1, documentName: 'x', settings: [] })
    let settled = false
    print.then(() => (settled = true), () => (settled = true))
    // The helper hangs on the list; it is killed at 5 s and never answers the print.
    await vi.advanceTimersByTimeAsync(6_000)
    expect(helper.process.killed).toBe(true)
    expect(settled).toBe(true)
  })
})
