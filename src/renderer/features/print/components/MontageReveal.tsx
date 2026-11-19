import { useEffect, useState, type CSSProperties } from 'react'
import { usePrefersReducedMotion } from '../hooks/usePrefersReducedMotion'
import { REVEAL, revealTotal, type RevealBox } from '../utils/reveal'

/**
 * Montage reveal over the sheet preview on the TV (DESIGN §14, Motion). Every fixed box starts as the
 * template's empty slot, and its photo slides up and fades into it, one photo after the other, until
 * the overlay matches the montage underneath pixel for pixel and goes away. The photos are crops of
 * the same montage JPEG (`url`), never another drawing of the photo. Plays once, from mount; under
 * `prefers-reduced-motion` it renders nothing and the montage shows at once. Purely decorative:
 * hidden from assistive tech and from the pointer.
 */
export function MontageReveal({ url, boxes }: { url: string; boxes: readonly RevealBox[] }) {
  const reduced = usePrefersReducedMotion()
  const [total] = useState(() => revealTotal(boxes))
  const [done, setDone] = useState(false)

  useEffect(() => {
    if (reduced || total === 0) return
    const timer = window.setTimeout(() => setDone(true), total + 80)
    return () => window.clearTimeout(timer)
  }, [reduced, total])

  if (reduced || done || boxes.length === 0) return null

  return (
    <div data-testid="montage-reveal" aria-hidden className="montage-reveal pointer-events-none absolute inset-0">
      {boxes.map((box) => {
        const radius = `${box.radiusX}% / ${box.radiusY}%`
        const style = {
          left: `${box.left}%`,
          top: `${box.top}%`,
          width: `${box.width}%`,
          height: `${box.height}%`,
          '--reveal-delay': `${box.delay}ms`,
          '--reveal-duration': `${REVEAL.duration}ms`,
        } as CSSProperties
        return (
          <div key={box.id} data-reveal-box={box.id} className="absolute" style={style}>
            {/* The template's empty slot, covered by the photo once it has landed. */}
            <div className="absolute inset-0 bg-stone-300" style={{ borderRadius: radius }} />
            <div className="montage-reveal-photo absolute inset-0 overflow-hidden" style={{ borderRadius: radius }}>
              {/* The whole sheet, scaled and shifted so only this box shows. */}
              <img
                src={url}
                alt=""
                draggable={false}
                className="absolute max-w-none"
                style={{
                  width: `${10000 / box.width}%`,
                  height: `${10000 / box.height}%`,
                  left: `${(-box.left / box.width) * 100}%`,
                  top: `${(-box.top / box.height) * 100}%`,
                }}
              />
            </div>
          </div>
        )
      })}
    </div>
  )
}
