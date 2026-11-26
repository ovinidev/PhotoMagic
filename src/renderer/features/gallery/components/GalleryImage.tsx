import { useEffect, useRef, useState } from 'react'
import { cn } from '@renderer/shared/utils/cn'
import { GALLERY_COPY } from '../copy'
import { useGalleryImage } from '../hooks/useGalleryImage'

const visibilityHandlers = new WeakMap<Element, (visible: boolean) => void>()
let thumbnailObserver: IntersectionObserver | undefined

/** Keeps the tile in the grid while loading only thumbnails near the viewport. */
export function GalleryThumbnail({ fileName, className, dark = false }: { fileName: string; className?: string; dark?: boolean }) {
  const tile = useRef<HTMLSpanElement>(null)
  const [visible, setVisible] = useState(typeof IntersectionObserver === 'undefined')

  useEffect(() => {
    const target = tile.current
    if (!target || typeof IntersectionObserver === 'undefined') return

    const observer = thumbnailObserver ??= new IntersectionObserver((entries) => {
      for (const entry of entries) visibilityHandlers.get(entry.target)?.(entry.isIntersecting)
    }, { rootMargin: '160px 0px' })
    visibilityHandlers.set(target, setVisible)
    observer.observe(target)
    return () => {
      observer.unobserve(target)
      visibilityHandlers.delete(target)
    }
  }, [])

  return (
    <span ref={tile} className={cn('block aspect-[1844/1240] w-full overflow-hidden', className)}>
      {visible ? <GalleryImage fileName={fileName} size="thumb" dark={dark} className="size-full" /> : null}
    </span>
  )
}

/** A montage image (thumbnail or file) with its loading and error states. */
export function GalleryImage({ fileName, size, className, dark }: { fileName: string; size: 'thumb' | 'full'; className?: string; dark?: boolean }) {
  const image = useGalleryImage(fileName, size)
  if (image.status === 'ready') {
    return <img src={image.url} alt={GALLERY_COPY.thumbAlt(fileName)} data-testid={size === 'full' ? 'gallery-full-image' : 'gallery-thumb'} className={cn('object-contain', className)} draggable={false} />
  }
  return (
    <span role="status" className={cn('flex items-center justify-center text-center', dark ? 'text-white/70' : 'text-ink-soft', className)}>
      {image.status === 'error' ? GALLERY_COPY.imageError : '…'}
    </span>
  )
}
