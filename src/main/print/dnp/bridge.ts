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

type Pending = { resolve: (payload: unknown) => void; reject: (error: Error) => void; timer: ReturnType<typeof setTimeout> }

/**
 * Keeps one helper process alive and talks to it line by line. The process starts on the first
 * request (loading System.Printing takes a moment, once), and again after it exits. A request that
 * times out kills the process: a driver call that hangs must not hang every print after it.
 */
export function createHelperBridge({ spawn, timeoutMs }: { spawn: () => HelperProcess; timeoutMs: (request: HelperRequest) => number }): HelperBridge {
  let child: HelperProcess | null = null
  let nextId = 1
  const pending = new Map<number, Pending>()

  const failAll = (error: Error) => {
    for (const [id, entry] of pending) {
      clearTimeout(entry.timer)
      pending.delete(id)
      entry.reject(error)
    }
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
        if (!response) return
        const entry = pending.get(response.id)
        if (!entry) return
        clearTimeout(entry.timer)
        pending.delete(response.id)
        entry.resolve(response.payload)
      })
    }
    return started
  }

  return {
    request: (request) =>
      new Promise((resolve, reject) => {
        const id = nextId++
        const timer = setTimeout(() => {
          pending.delete(id)
          reject(new Error(`print helper did not answer ${request.action} in time`))
          const hung = child
          child = null
          hung?.kill()
        }, timeoutMs(request))
        pending.set(id, { resolve, reject, timer })
        try {
          child ??= start()
          if (!child.stdin) throw new Error('print helper has no stdin')
          child.stdin.write(encodeRequest(id, request))
        } catch (error) {
          clearTimeout(timer)
          pending.delete(id)
          reject(error instanceof Error ? error : new Error(String(error)))
        }
      }),
    dispose: () => {
      const current = child
      child = null
      failAll(new Error('print helper stopped'))
      current?.kill()
    },
  }
}
