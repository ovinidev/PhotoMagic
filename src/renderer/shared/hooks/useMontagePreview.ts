import { useEffect, useState } from 'react'
import { useObjectUrl } from './useObjectUrl'

export type MontagePreview = { status: 'loading' } | { status: 'ready'; url: string | null } | { status: 'error' }

/**
 * The round's montage preview, composed by main with the same code as the file (DESIGN §6). Fetched
 * again whenever `revision` (from `session:state`) moves; the laptop and the TV show the same image.
 */
export function useMontagePreview(revision: number): MontagePreview {
  const [bytes, setBytes] = useState<{ status: 'loading' } | { status: 'ready'; jpeg: Uint8Array | null } | { status: 'error' }>({ status: 'loading' })

  useEffect(() => {
    let active = true
    window.fotomagica.session
      .getPreview()
      .then((preview) => active && setBytes({ status: 'ready', jpeg: preview.jpeg }))
      .catch(() => active && setBytes({ status: 'error' }))
    return () => {
      active = false
    }
  }, [revision])

  const url = useObjectUrl(bytes.status === 'ready' ? bytes.jpeg : null)
  if (bytes.status !== 'ready') return bytes
  return { status: 'ready', url: bytes.jpeg ? url : null }
}
