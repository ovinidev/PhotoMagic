import { useCallback, useEffect, useRef } from 'react'
import type { Framing } from '@shared/layout'

/** Shortest gap between two `session:set-framing` during a gesture: at most 5 a second (DESIGN §8). */
export const FRAMING_SEND_INTERVAL_MS = 200

/**
 * Sends framing changes to main without flooding it (RF09). The laptop draws the drag itself; main
 * only recomposes the preview the TV shows. At most one `session:set-framing` in flight and at most
 * one every 200 ms; only the latest framing per slot waits, and the last one always goes out.
 * `final` (pointer released, a button) skips the 200 ms wait.
 */
export function useFramingSender(): (slotId: string, framing: Framing, options?: { final?: boolean }) => void {
  const inFlight = useRef(false)
  const lastSent = useRef(Number.NEGATIVE_INFINITY)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const pending = useRef(new Map<string, Framing>())
  /** A final send was asked for and not done yet (it may wait for the one in flight). */
  const finalOwed = useRef(false)
  const mounted = useRef(true)

  useEffect(() => {
    mounted.current = true
    return () => {
      mounted.current = false
      if (timer.current) clearTimeout(timer.current)
    }
  }, [])

  const run = useCallback(function run() {
    if (inFlight.current || !mounted.current || pending.current.size === 0) return
    const wait = lastSent.current + FRAMING_SEND_INTERVAL_MS - Date.now()
    if (!finalOwed.current && wait > 0) {
      timer.current ??= setTimeout(() => {
        timer.current = null
        run()
      }, wait)
      return
    }
    if (timer.current) {
      clearTimeout(timer.current)
      timer.current = null
    }
    const [slotId, framing] = pending.current.entries().next().value!
    pending.current.delete(slotId)
    if (pending.current.size === 0) finalOwed.current = false
    inFlight.current = true
    lastSent.current = Date.now()
    window.fotomagica.session
      .setFraming({ slotId, framing })
      .catch(() => {})
      .finally(() => {
        inFlight.current = false
        run()
      })
  }, [])

  return useCallback(
    (slotId, framing, { final = false } = {}) => {
      pending.current.set(slotId, framing)
      if (final) finalOwed.current = true
      run()
    },
    [run],
  )
}
