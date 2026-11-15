import { useCallback, useEffect, useState } from 'react'
import type { TemplateImportResult, Templates } from '@shared/ipc'
import type { PrintMode } from '@shared/layout'

export type TemplatesView = { status: 'loading' } | { status: 'ready'; value: Templates } | { status: 'error' }
export type ImportState = { status: 'idle' } | { status: 'loading' } | { status: 'rejected'; result: Exclude<TemplateImportResult, { ok: true }> }

/**
 * Each mode's stored template and the import of a new one (PRD §6.1). A rejected file is reported for
 * that mode only and blocks `Iniciar evento` until a valid file is imported; the other mode is untouched.
 */
export function useTemplates() {
  const [templates, setTemplates] = useState<TemplatesView>({ status: 'loading' })
  const [imports, setImports] = useState<Record<PrintMode, ImportState>>({ 'two-strips': { status: 'idle' }, 'one-strip': { status: 'idle' } })

  useEffect(() => {
    let active = true
    window.fotomagica.template
      .getAll()
      .then((value) => active && setTemplates({ status: 'ready', value }))
      .catch(() => active && setTemplates({ status: 'error' }))
    return () => {
      active = false
    }
  }, [])

  const importFile = useCallback(async (mode: PrintMode, file: File) => {
    setImports((current) => ({ ...current, [mode]: { status: 'loading' } }))
    try {
      const bytes = new Uint8Array(await file.arrayBuffer())
      const result = await window.fotomagica.template.import({ mode, fileName: file.name || 'template', bytes })
      if (result.ok) {
        setTemplates((current) =>
          current.status === 'ready' ? { status: 'ready', value: { ...current.value, [mode]: result.template } } : current,
        )
        setImports((current) => ({ ...current, [mode]: { status: 'idle' } }))
      } else {
        setImports((current) => ({ ...current, [mode]: { status: 'rejected', result } }))
      }
    } catch {
      setImports((current) => ({ ...current, [mode]: { status: 'rejected', result: { ok: false, reason: 'unreadable' } } }))
    }
  }, [])

  return { templates, imports, importFile }
}
