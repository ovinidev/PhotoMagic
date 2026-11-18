import { useEffect, useMemo, useState } from 'react'
import logoUrl from '@brand/logo.png'
import { useGallery, useGalleryImage } from '@renderer/features/gallery'
import { ATTRACT_COPY } from '../copy'
import { useAttractIdle } from '../hooks/useAttractIdle'
import { usePrefersReducedMotion } from '../hooks/usePrefersReducedMotion'
import { ATTRACT_FADE_MS, ATTRACT_SLIDE_MS, nextSlide, recentSlides } from '../utils/slides'

/** Time the attract layer takes to fade out after a touch, in sync with `attract-leave` in `index.css`. */
const LEAVE_MS = 300

/**
 * One montage, as its 480 px gallery thumbnail. Nothing renders until the bytes arrive, so the
 * crossfade starts on a ready image. The same object URL also paints the blurred backdrop.
 */
function AttractSlide({ fileName }: { fileName: string }) {
  const image = useGalleryImage(fileName, 'thumb')
  if (image.status !== 'ready') return null
  return (
    <div className="attract-slide absolute inset-0" data-testid="attract-slide" data-file-name={fileName}>
      <img src={image.url} alt="" aria-hidden className="absolute inset-0 size-full scale-110 object-cover opacity-50 blur-3xl" draggable={false} />
      <div className="absolute inset-x-0 top-0 bottom-[22%] flex items-center justify-center px-12">
        <img
          src={image.url}
          alt={ATTRACT_COPY.photoAlt}
          className="attract-drift max-h-full w-full rounded-[32px] object-contain shadow-[0_24px_80px_rgba(0,0,0,0.55)]"
          draggable={false}
        />
      </div>
    </div>
  )
}

/**
 * The newest montages, one at a time, the next one crossfading over the last every
 * `ATTRACT_SLIDE_MS`. Only the leaving and the entering slide are mounted, so at most two thumbnails
 * are in memory. Reduced motion shows the newest one, still.
 */
function AttractSlides({ fileNames, reduced }: { fileNames: string[]; reduced: boolean }) {
  const [slide, setSlide] = useState<{ index: number; previous: string | null }>({ index: 0, previous: null })
  const count = fileNames.length
  const index = reduced || count === 0 ? 0 : slide.index % count
  const current = fileNames[index] ?? null
  const previous = !reduced && slide.previous !== current ? slide.previous : null

  useEffect(() => {
    if (reduced || count < 2) return
    const timer = window.setInterval(
      () => setSlide((state) => ({ previous: fileNames[state.index % count] ?? null, index: nextSlide(state.index % count, count) })),
      ATTRACT_SLIDE_MS,
    )
    return () => window.clearInterval(timer)
  }, [reduced, count, fileNames])

  return (
    <div className="absolute inset-0 bg-black" data-testid="attract-slides" style={{ ['--attract-fade' as string]: `${ATTRACT_FADE_MS}ms`, ['--attract-slide' as string]: `${ATTRACT_SLIDE_MS + ATTRACT_FADE_MS}ms` }}>
      {/* Keyed by name: the slide that was current stays mounted (no reload, no restart) under the new one. */}
      {[previous, current].filter((name): name is string => name !== null).map((name) => (
        <AttractSlide key={name} fileName={name} />
      ))}
    </div>
  )
}

/** No montage yet (or the gallery is still loading): the full logo on the laptop's light paper. */
function AttractBrand() {
  return (
    <div className="absolute inset-0 flex items-center justify-center bg-bg pb-[22%]" data-testid="attract-brand">
      <img src={logoUrl} alt={ATTRACT_COPY.brandAlt} className="w-[72%] max-w-[780px]" draggable={false} />
    </div>
  )
}

/**
 * TV attract screen (DESIGN §14, Attract screen): after a fresh round sits untouched for a while, the
 * event's newest montages cycle slowly behind a pulsing `Toque para começar`; with none yet, the
 * brand art. The whole surface is one button: a tap fades it out over the camera, which never
 * stopped, and the round goes on as it was. Main is not told; this is TV-only presentation.
 */
export function AttractScreen({ active }: { active: boolean }) {
  const { showing, dismiss } = useAttractIdle(active)
  const reduced = usePrefersReducedMotion()
  const [leaving, setLeaving] = useState(false)
  const [wasShowing, setWasShowing] = useState(showing)

  if (wasShowing !== showing) {
    setWasShowing(showing)
    setLeaving(!showing)
  }

  useEffect(() => {
    if (!leaving) return
    const timer = window.setTimeout(() => setLeaving(false), LEAVE_MS + 100)
    return () => window.clearTimeout(timer)
  }, [leaving])

  if (!showing && !leaving) return null
  return <AttractLayer leaving={leaving} reduced={reduced} onStart={dismiss} />
}

function AttractLayer({ leaving, reduced, onStart }: { leaving: boolean; reduced: boolean; onStart: () => void }) {
  const gallery = useGallery()
  const fileNames = useMemo(() => (gallery.status === 'ready' ? recentSlides(gallery.fileNames) : []), [gallery])

  return (
    <div
      data-testid="attract-screen"
      data-motion={reduced ? 'reduced' : 'full'}
      className={`absolute inset-0 z-[45] ${leaving ? 'attract-leave' : 'attract-enter'}`}
      inert={leaving}
      aria-hidden={leaving || undefined}
    >
      <button type="button" onClick={onStart} aria-label={ATTRACT_COPY.cta} className="absolute inset-0 cursor-pointer focus-visible:outline-none">
        {fileNames.length > 0 ? <AttractSlides fileNames={fileNames} reduced={reduced} /> : <AttractBrand />}
        <span className="absolute inset-x-0 bottom-[9%] flex justify-center">
          <span
            data-testid="attract-cta"
            className="attract-pulse flex min-h-32 items-center gap-6 rounded-full bg-ink px-16 text-[64px] leading-none font-semibold text-primary-ink shadow-[0_12px_48px_rgba(0,0,0,0.45)] ring-4 ring-white/70"
          >
            <span aria-hidden className="size-10 rounded-full border-[6px] border-white" />
            {ATTRACT_COPY.cta}
          </span>
        </span>
      </button>
    </div>
  )
}
