import { useEffect, useRef, useState } from 'react'
import { PHOTO_INDEXES, type PhotoIndex } from '@shared/layout'

export type RoundPhoto = { url: string; width: number; height: number }

/**
 * The round's captures on the laptop, as object URLs with their pixel size, for the local framing
 * preview (DESIGN §8). Fetched once each from main as they are taken; dropped when a new round starts.
 */
export function useRoundPhotos(taken: number): Partial<Record<PhotoIndex, RoundPhoto>> {
  const [photos, setPhotos] = useState<Partial<Record<PhotoIndex, RoundPhoto>>>({})
  const urls = useRef(new Map<PhotoIndex, string>())

  useEffect(() => {
    let active = true
    for (const index of PHOTO_INDEXES) {
      if (index <= taken) continue
      // Not taken (a new round or a cancel): forget the old capture.
      const url = urls.current.get(index)
      if (url) {
        urls.current.delete(index)
        URL.revokeObjectURL(url)
        setPhotos(({ [index]: _gone, ...rest }) => rest)
      }
    }
    for (const index of PHOTO_INDEXES) {
      if (index > taken || urls.current.has(index)) continue
      window.fotomagica.session
        .getPhoto(index)
        .then(async (jpeg) => {
          if (!active || !jpeg || urls.current.has(index)) return
          const blob = new Blob([jpeg as Uint8Array<ArrayBuffer>], { type: 'image/jpeg' })
          const bitmap = await createImageBitmap(blob).catch(() => null)
          if (!active || !bitmap || urls.current.has(index)) return
          const url = URL.createObjectURL(blob)
          urls.current.set(index, url)
          setPhotos((current) => ({ ...current, [index]: { url, width: bitmap.width, height: bitmap.height } }))
          bitmap.close()
        })
        .catch(() => {})
    }
    return () => {
      active = false
    }
  }, [taken])

  useEffect(() => {
    const owned = urls.current
    return () => {
      for (const url of owned.values()) URL.revokeObjectURL(url)
      owned.clear()
    }
  }, [])

  return photos
}
