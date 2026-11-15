import { useEffect, useState } from 'react'

export type GalleryView = { status: 'loading' } | { status: 'ready'; fileNames: string[] } | { status: 'error' }

/**
 * The event folder's montages, newest first (RF14), read again whenever main says a montage was
 * written (`gallery:changed`). Only names cross IPC; images are fetched one by one.
 */
export function useGallery(): GalleryView {
  const [view, setView] = useState<GalleryView>({ status: 'loading' })
  const [revision, setRevision] = useState(0)

  useEffect(() => window.fotomagica.gallery.onChanged(() => setRevision((value) => value + 1)), [])

  useEffect(() => {
    let active = true
    window.fotomagica.gallery
      .list()
      .then(({ fileNames }) => active && setView({ status: 'ready', fileNames }))
      .catch(() => active && setView({ status: 'error' }))
    return () => {
      active = false
    }
  }, [revision])

  return view
}
