import { useCallback, useEffect, useRef } from 'react'
import type { Framing } from '@shared/layout'

/**
 * Sends framing changes to main without flooding it (RF09): at most one `session:set-framing` in
 * flight; while it runs, only the latest framing per slot waits, and goes out when it returns. Main
 * recomposes the preview, so the TV print screen follows the drag a few times per second.
 */
export function useFramingSender(): (slotId: string, framing: Framing) => void {
  const inFlight = useRef(false)
  const pending = useRef(new Map<string, Framing>())
  const mounted = useRef(true)

  useEffect(() => {
    mounted.current = true
    return () => {
      mounted.current = false
    }
  }, [])

  const flush = useCallback(() => {
    const run = () => {
      if (inFlight.current || !mounted.current) return
      const next = pending.current.entries().next()
      if (next.done) return
      const [slotId, framing] = next.value
      pending.current.delete(slotId)
      inFlight.current = true
      window.fotomagica.session
        .setFraming({ slotId, framing })
        .catch(() => {})
        .finally(() => {
          inFlight.current = false
          run()
        })
    }
    run()
  }, [])

  return useCallback(
    (slotId, framing) => {
      pending.current.set(slotId, framing)
      flush()
    },
    [flush],
  )
}
