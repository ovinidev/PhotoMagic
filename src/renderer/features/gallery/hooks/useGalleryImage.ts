import { useEffect, useState } from 'react'
import { useObjectUrl } from '@renderer/shared/hooks/useObjectUrl'

export type GalleryImageView = { status: 'loading' } | { status: 'ready'; url: string } | { status: 'error' }

/** One montage as an object URL: the thumbnail for lists, the file for the fullscreen view. */
export function useGalleryImage(fileName: string, size: 'thumb' | 'full'): GalleryImageView {
  const [bytes, setBytes] = useState<{ key: string; jpeg: Uint8Array | null; failed: boolean } | null>(null)
  const key = `${fileName}:${size}`

  useEffect(() => {
    let active = true
    window.fotomagica.gallery
      .get({ fileName, size })
      .then(({ jpeg }) => active && setBytes({ key, jpeg, failed: jpeg === null }))
      .catch(() => active && setBytes({ key, jpeg: null, failed: true }))
    return () => {
      active = false
    }
  }, [fileName, size, key])

  const current = bytes?.key === key ? bytes : null
  const url = useObjectUrl(current?.jpeg ?? null)
  if (!current) return { status: 'loading' }
  if (current.failed || !url) return { status: 'error' }
  return { status: 'ready', url }
}
