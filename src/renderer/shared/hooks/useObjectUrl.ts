import { useEffect, useMemo } from 'react'

/** An object URL for JPEG bytes, revoked when the bytes change or the component unmounts. */
export function useObjectUrl(bytes: Uint8Array | null, type = 'image/jpeg'): string | null {
  const url = useMemo(() => (bytes ? URL.createObjectURL(new Blob([bytes as Uint8Array<ArrayBuffer>], { type })) : null), [bytes, type])
  useEffect(() => {
    if (!url) return
    return () => URL.revokeObjectURL(url)
  }, [url])
  return url
}
