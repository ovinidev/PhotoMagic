import { cn } from '@renderer/shared/utils/cn'
import { GALLERY_COPY } from '../copy'
import { useGalleryImage } from '../hooks/useGalleryImage'

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
