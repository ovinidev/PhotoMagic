import { useEffect, useMemo, useState } from 'react'
import logoUrl from '@brand/logo.png'
import { useGallery, useGalleryImage } from '@renderer/features/gallery'
import { ATTRACT_COPY } from '../copy'
import { useAttractIdle } from '../hooks/useAttractIdle'
import { ATTRACT_SLIDE_MS, nextSlide, recentSlides } from '../utils/slides'

/** One montage, as its 480 px gallery thumbnail. The same object URL also paints the blurred backdrop. */
function AttractSlide({ fileName }: { fileName: string }) {
  const image = useGalleryImage(fileName, 'thumb')
  if (image.status !== 'ready') return null
  return (
    <div className="absolute inset-0" data-testid="attract-slide" data-file-name={fileName}>
      <img src={image.url} alt="" aria-hidden className="absolute inset-0 size-full scale-110 object-cover opacity-50 blur-3xl" draggable={false} />
      <div className="absolute inset-x-0 top-0 bottom-[22%] flex items-center justify-center px-12">
        <img src={image.url} alt={ATTRACT_COPY.photoAlt} className="max-h-full w-full rounded-[32px] object-contain shadow-[0_24px_80px_rgba(0,0,0,0.55)]" draggable={false} />
      </div>
    </div>
  )
}

/** The newest montages, one at a time, the next one replacing the last every `ATTRACT_SLIDE_MS`. */
function AttractSlides({ fileNames }: { fileNames: string[] }) {
  const [index, setIndex] = useState(0)
  const count = fileNames.length
  const current = fileNames[count === 0 ? 0 : index % count] ?? null

  useEffect(() => {
    if (count < 2) return
    const timer = window.setInterval(() => setIndex((value) => nextSlide(value % count, count)), ATTRACT_SLIDE_MS)
    return () => window.clearInterval(timer)
  }, [count])

  return (
    <div className="absolute inset-0 bg-black" data-testid="attract-slides">
      {current ? <AttractSlide key={current} fileName={current} /> : null}
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
 * event's newest montages cycle behind `Toque para começar`; with none yet, the brand art. The whole
 * surface is one button: a tap hides it over the camera, which never stopped, and the round goes on
 * as it was. Main is not told; this is TV-only presentation.
 */
export function AttractScreen({ active }: { active: boolean }) {
  const { showing, dismiss } = useAttractIdle(active)
  if (!showing) return null
  return <AttractLayer onStart={dismiss} />
}

function AttractLayer({ onStart }: { onStart: () => void }) {
  const gallery = useGallery()
  const fileNames = useMemo(() => (gallery.status === 'ready' ? recentSlides(gallery.fileNames) : []), [gallery])

  return (
    <div data-testid="attract-screen" className="absolute inset-0 z-[45]">
      <button type="button" onClick={onStart} aria-label={ATTRACT_COPY.cta} className="absolute inset-0 cursor-pointer focus-visible:outline-none">
        {fileNames.length > 0 ? <AttractSlides fileNames={fileNames} /> : <AttractBrand />}
        <span className="absolute inset-x-0 bottom-[9%] flex justify-center">
          <span
            data-testid="attract-cta"
            className="flex min-h-32 items-center gap-6 rounded-full bg-ink px-16 text-[64px] leading-none font-semibold text-primary-ink shadow-[0_12px_48px_rgba(0,0,0,0.45)] ring-4 ring-white/70"
          >
            <span aria-hidden className="size-10 rounded-full border-[6px] border-white" />
            {ATTRACT_COPY.cta}
          </span>
        </span>
      </button>
    </div>
  )
}
