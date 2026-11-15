import { useEffect, useState } from 'react'

/** An object URL for JPEG bytes, revoked when the bytes change or the component unmounts. */
export function useObjectUrl(bytes: Uint8Array | null, type = 'image/jpeg'): string | null {
  const [url, setUrl] = useState<string | null>(null)
  useEffect(() => {
    if (!bytes) {
      setUrl(null)
      return
    }
    const next = URL.createObjectURL(new Blob([bytes as Uint8Array<ArrayBuffer>], { type }))
    setUrl(next)
    return () => URL.revokeObjectURL(next)
  }, [bytes, type])
  return url
}
