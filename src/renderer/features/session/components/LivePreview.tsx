import { useEffect, useRef, useState } from 'react'
import { LAPTOP_PREVIEW } from '@shared/constants'
import type { EventSession } from '@shared/ipc'
import { PHOTOS_PER_ROUND, guideCrop, type PhotoIndex } from '@shared/layout'
import { PREVIEW_ACK, listenForPreviewPort } from '@renderer/shared/utils/previewPort'
import { SESSION_COPY } from '../copy'

type Bitmap = { width: number; height: number; close: () => void }
const isBitmap = (value: unknown): value is Bitmap & CanvasImageSource =>
  typeof value === 'object' && value !== null && 'close' in value && 'width' in value && 'height' in value

/**
 * The live camera on the laptop (PRD §6.3, DESIGN §5, §8): the frames the TV transfers over the
 * `MessageChannel`, already rotated and mirrored, without the TV chrome. Each frame is acknowledged
 * after drawing, so the TV never queues more than one. The guide marks what the next photo's slots
 * keep: the bottom strip's band in 2 tiras, the portrait slot in 1 tira.
 */
export function LivePreview({ session }: { session: EventSession }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [receiving, setReceiving] = useState(false)

  useEffect(() => {
    const context = canvasRef.current?.getContext('2d') ?? null
    let port: MessagePort | null = null
    const stop = listenForPreviewPort((next) => {
      port?.close()
      port = next
      next.onmessage = (event: MessageEvent<unknown>) => {
        const frame = event.data
        if (!isBitmap(frame)) return
        context?.drawImage(frame, 0, 0, LAPTOP_PREVIEW.width, LAPTOP_PREVIEW.height)
        frame.close()
        setReceiving(true)
        next.postMessage(PREVIEW_ACK)
      }
    })
    return () => {
      stop()
      port?.close()
    }
  }, [])

  const next = Math.min(session.taken + 1, PHOTOS_PER_ROUND) as PhotoIndex
  const guide = guideCrop(session.slots, next, LAPTOP_PREVIEW)

  return (
    <figure className="flex flex-col gap-3">
      <figcaption className="eyebrow">{SESSION_COPY.live}</figcaption>
      <div className="relative aspect-[9/16] h-[560px] overflow-hidden rounded-[var(--radius-card)] bg-ink" data-testid="live-preview" data-receiving={receiving}>
        <canvas ref={canvasRef} width={LAPTOP_PREVIEW.width} height={LAPTOP_PREVIEW.height} aria-label={SESSION_COPY.liveAlt} className="absolute inset-0 h-full w-full" />
        {guide && session.phase.kind === 'capturing' ? (
          <div
            data-testid="live-guide"
            aria-label={SESSION_COPY.guide(next)}
            className="pointer-events-none absolute border-2 border-dashed border-white/90 shadow-[0_0_0_9999px_rgba(0,0,0,0.45)]"
            style={{
              left: `${guide.left * 100}%`,
              top: `${guide.top * 100}%`,
              width: `${guide.width * 100}%`,
              height: `${guide.height * 100}%`,
            }}
          />
        ) : null}
        {!receiving ? (
          <p role="status" className="absolute inset-x-6 top-1/2 -translate-y-1/2 text-center text-sm text-white/80">
            {SESSION_COPY.liveWaiting}
          </p>
        ) : null}
      </div>
    </figure>
  )
}
