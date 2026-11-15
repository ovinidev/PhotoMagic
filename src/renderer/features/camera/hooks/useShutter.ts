import { useCallback, useEffect, useRef, useState, type RefObject } from 'react'
import type { EventSession } from '@shared/ipc'
import { PHOTOS_PER_ROUND, type PhotoIndex } from '@shared/layout'
import { captureStill, type VideoFrameSource } from '../utils/captureStill'

/** If main has not counted the photo after this long, the shutter unlocks so the guests can tap again. */
const PHOTO_ACK_TIMEOUT_MS = 5000
const FLASH_MS = 80

export type ShutterState = {
  /** Seconds left on the countdown, or `null` when none is running. */
  countdown: number | null
  flashing: boolean
  /** A countdown or a capture is running: taps do nothing (RF06). */
  busy: boolean
  failed: boolean
  trigger: () => void
}

type Options = {
  session: EventSession | null
  videoRef: RefObject<HTMLVideoElement | null>
  /** Injected in tests. */
  capture?: (video: VideoFrameSource) => Promise<Uint8Array>
  wait?: (ms: number) => Promise<void>
}

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms))

/**
 * The TV shutter (PRD §6.4, RF06, RF07). The white button and the laptop's request (`session:shutter`)
 * run this same path: the timer countdown, then the still through `captureStill` (the same transform
 * as the preview), delivered to main as photo `taken + 1`. One capture at a time; main also ignores a
 * photo that is not the next one, so a double tap never adds a fourth photo.
 */
export function useShutter({ session, videoRef, capture = captureStill, wait = sleep }: Options): ShutterState {
  const [countdown, setCountdown] = useState<number | null>(null)
  const [flashing, setFlashing] = useState(false)
  const [pending, setPending] = useState<PhotoIndex | null>(null)
  const [failed, setFailed] = useState(false)
  const sessionRef = useRef(session)
  const pendingRef = useRef<PhotoIndex | null>(null)
  const mounted = useRef(true)

  useEffect(() => {
    sessionRef.current = session
  }, [session])

  useEffect(() => {
    mounted.current = true
    return () => {
      mounted.current = false
    }
  }, [])

  const release = useCallback(() => {
    pendingRef.current = null
    if (mounted.current) setPending(null)
  }, [])

  // Main counted the photo (or the round moved on): the next tap may take the next one.
  const taken = session?.taken ?? 0
  const phase = session?.phase.kind ?? null
  useEffect(() => {
    const index = pendingRef.current
    if (index !== null && (taken >= index || phase !== 'capturing')) release()
  }, [taken, phase, release])

  const trigger = useCallback(() => {
    const current = sessionRef.current
    const video = videoRef.current
    if (!current || current.phase.kind !== 'capturing' || current.taken >= PHOTOS_PER_ROUND) return
    if (pendingRef.current !== null || !video) return
    const index = (current.taken + 1) as PhotoIndex
    pendingRef.current = index
    setPending(index)
    setFailed(false)

    void (async () => {
      try {
        for (let seconds = current.timer; seconds > 0; seconds--) {
          if (!mounted.current) return
          setCountdown(seconds)
          await wait(1000)
        }
        if (!mounted.current) return
        setCountdown(null)
        setFlashing(true)
        setTimeout(() => mounted.current && setFlashing(false), FLASH_MS)
        const jpeg = await capture(video)
        window.fotomagica.session.sendPhoto({ index, jpeg })
        setTimeout(() => {
          if (pendingRef.current === index) release()
        }, PHOTO_ACK_TIMEOUT_MS)
      } catch {
        if (mounted.current) {
          setCountdown(null)
          setFailed(true)
        }
        release()
      }
    })()
  }, [videoRef, capture, wait, release])

  // The laptop's `Tirar foto` runs the same path (DESIGN §4).
  useEffect(() => window.fotomagica.session.onShutter(trigger), [trigger])

  return { countdown, flashing, busy: pending !== null, failed, trigger }
}
