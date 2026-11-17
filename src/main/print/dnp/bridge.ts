import { createInterface } from 'node:readline'
import type { Readable } from 'node:stream'
import { encodeRequest, parseResponseLine, type HelperRequest } from './protocol'

/** The bit of `ChildProcess` the bridge uses, so tests can hand in a fake. */
export type HelperProcess = {
  stdin: { write: (chunk: string) => unknown } | null
  stdout: Readable | null
  once: (event: 'exit' | 'error', listener: (...args: unknown[]) => void) => unknown
  kill: () => unknown
}

export type HelperBridge = {
  /** Sends one request; rejects on timeout or if the helper dies before answering. */
  request: (request: HelperRequest) => Promise<unknown>
  dispose: () => void
}

type Queued = { id: number; request: HelperRequest; resolve: (payload: unknown) => void; reject: (error: Error) => void }
type InFlight = Queued & { timer: ReturnType<typeof setTimeout> }

/**
 * Keeps one helper process alive and talks to it line by line. The process starts on the first
 * request (loading System.Printing takes a moment, once), and again after it exits.
 *
 * The helper reads one request at a time, so the bridge sends one at a time too: a request's
 * timeout starts when it is sent, never while it waits behind a slow print (a status poll queued
 * behind ten copies must not time out and kill the print). A request that times out kills the
 * process, since a driver call that hangs must not hang every print after it, and whatever was
 * queued behind it fails at once instead of waiting for its own timeout.
 */
export function createHelperBridge({ spawn, timeoutMs }: { spawn: () => HelperProcess; timeoutMs: (request: HelperRequest) => number }): HelperBridge {
  let child: HelperProcess | null = null
  let nextId = 1
  let inFlight: InFlight | null = null
  const queue: Queued[] = []

  const failAll = (error: Error) => {
    const current = inFlight
    inFlight = null
    if (current) {
      clearTimeout(current.timer)
      current.reject(error)
    }
    for (const entry of queue.splice(0)) entry.reject(error)
  }

  const stop = (error: Error) => {
    const current = child
    child = null
    failAll(error)
    current?.kill()
  }

  const start = (): HelperProcess => {
    const started = spawn()
    const onGone = (reason: string) => {
      if (child !== started) return
      child = null
      failAll(new Error(reason))
    }
    started.once('exit', (code) => onGone(`print helper exited (${String(code)})`))
    started.once('error', (error) => onGone(`print helper failed to start: ${error instanceof Error ? error.message : String(error)}`))
    if (started.stdout) {
      createInterface({ input: started.stdout }).on('line', (line) => {
        const response = parseResponseLine(line)
        if (!response || child !== started || !inFlight || response.id !== inFlight.id) return
        const done = inFlight
        inFlight = null
        clearTimeout(done.timer)
        done.resolve(response.payload)
        pump()
      })
    }
    return started
  }

  const pump = () => {
    while (!inFlight && queue.length > 0) {
      const entry = queue.shift()!
      try {
        child ??= start()
        if (!child.stdin) throw new Error('print helper has no stdin')
        const timer = setTimeout(() => {
          stop(new Error(`print helper did not answer ${entry.request.action} in time`))
        }, timeoutMs(entry.request))
        inFlight = { ...entry, timer }
        child.stdin.write(encodeRequest(entry.id, entry.request))
      } catch (error) {
        if (inFlight?.id === entry.id) clearTimeout(inFlight.timer)
        inFlight = null
        entry.reject(error instanceof Error ? error : new Error(String(error)))
      }
    }
  }

  return {
    request: (request) =>
      new Promise((resolve, reject) => {
        queue.push({ id: nextId++, request, resolve, reject })
        pump()
      }),
    dispose: () => stop(new Error('print helper stopped')),
  }
}
