import { useEffect, useState } from 'react'
import type { Templates } from '@shared/ipc'
import type { PrintMode } from '@shared/layout'
import { useObjectUrl } from '@renderer/shared/hooks/useObjectUrl'

/** The stored template of `mode` as an image URL for the editor background, or `null` when there is none. */
export function useTemplatePreview(mode: PrintMode): string | null {
  const [templates, setTemplates] = useState<Templates | null>(null)
  useEffect(() => {
    let active = true
    window.fotomagica.template
      .getAll()
      .then((value) => active && setTemplates(value))
      .catch(() => active && setTemplates(null))
    return () => {
      active = false
    }
  }, [])
  return useObjectUrl(templates?.[mode]?.preview ?? null)
}
