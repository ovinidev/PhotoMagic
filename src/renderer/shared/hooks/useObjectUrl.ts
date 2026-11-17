import { useEffect, useState } from 'react'

/**
 * An object URL for JPEG bytes, revoked when the bytes change or the component unmounts.
 * Created inside the effect (not in `useMemo`) so StrictMode's mount → cleanup → mount
 * makes a fresh URL instead of returning one that was already revoked.
 */
export function useObjectUrl(bytes: Uint8Array | null, type = 'image/jpeg'): string | null {
  const [url, setUrl] = useState<string | null>(null)
  useEffect(() => {
    if (!bytes) {
      // oxlint-disable-next-line react/set-state-in-effect -- the object URL is an external resource owned by this effect
      setUrl(null)
      return
    }
    const created = URL.createObjectURL(new Blob([bytes as Uint8Array<ArrayBuffer>], { type }))
    // oxlint-disable-next-line react/set-state-in-effect -- the object URL is an external resource owned by this effect
    setUrl(created)
    return () => URL.revokeObjectURL(created)
  }, [bytes, type])
  return url
}
