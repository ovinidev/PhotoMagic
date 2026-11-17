import { useId, type ReactNode } from 'react'
import type { TemplateInfo } from '@shared/ipc'
import type { PrintMode } from '@shared/layout'
import { SheetGuides } from '@renderer/features/layout'
import { useObjectUrl } from '@renderer/shared/hooks/useObjectUrl'
import { cn } from '@renderer/shared/utils/cn'
import { EVENTS_COPY } from '../copy'
import type { ImportState, TemplatesView } from '../hooks/useTemplates'

function rejection(state: ImportState): string | null {
  if (state.status !== 'rejected') return null
  const { result } = state
  if (result.reason === 'size') return EVENTS_COPY.templateErrors.size(result.width ?? 0, result.height ?? 0)
  return EVENTS_COPY.templateErrors[result.reason]
}

/** The selected mode's template: preview, file name, import, and the loading, empty and error states. */
export function TemplatePicker({
  mode,
  modeLabel,
  templates,
  template,
  importState,
  onFile,
  actions,
}: {
  mode: PrintMode
  modeLabel: string
  templates: TemplatesView
  template: TemplateInfo | null
  importState: ImportState
  onFile: (file: File) => void
  /** Extra buttons on the import row, e.g. `Editar posições das fotos`. */
  actions?: ReactNode
}) {
  const inputId = useId()
  const url = useObjectUrl(template?.preview ?? null)
  const error = rejection(importState)
  const loading = importState.status === 'loading'

  return (
    <fieldset className="flex min-w-0 max-w-full flex-col gap-3">
      <legend className="mb-2 text-base font-medium text-ink">{EVENTS_COPY.template(modeLabel)}</legend>
      <div className="flex aspect-[1844/1240] w-full max-w-full items-center justify-center overflow-hidden rounded-[var(--radius-field)] border border-line bg-bg">
        {templates.status === 'loading' ? (
          <p className="text-sm text-ink-soft">{EVENTS_COPY.templatesLoading}</p>
        ) : templates.status === 'error' ? (
          <p className="text-sm text-danger">{EVENTS_COPY.templatesError}</p>
        ) : url ? (
          <img src={url} alt={EVENTS_COPY.templatePreviewAlt(modeLabel)} data-testid="template-preview" className="h-full w-full object-contain" draggable={false} />
        ) : (
          // No template: the plain white default sheet with the standard boxes (PRD §6.1).
          <div role="img" aria-label={EVENTS_COPY.templateDefaultAlt(modeLabel)} data-testid="template-default" className="relative h-full w-full bg-white">
            <SheetGuides mode={mode} />
          </div>
        )}
      </div>
      <p className="min-w-0 truncate text-sm text-ink-soft" data-testid="template-file-name" title={template?.fileName}>
          {template ? `${template.fileName} · ${template.width} × ${template.height} px` : templates.status === 'ready' ? EVENTS_COPY.templateDefault : ''}
      </p>
      <div className="flex min-w-0 flex-wrap items-center justify-end gap-3" data-testid="template-actions">
        {actions}
        <label
          htmlFor={inputId}
          aria-disabled={loading}
          className={cn(
            'inline-flex min-h-11 max-w-full cursor-pointer items-center rounded-[var(--radius-field)] border border-line px-5 text-sm font-medium text-ink hover:bg-bg',
            'focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-ink',
            loading && 'pointer-events-none opacity-50',
          )}
        >
          {loading ? EVENTS_COPY.templateLoading : template ? EVENTS_COPY.templateReplace : EVENTS_COPY.templateImport}
          <input
            id={inputId}
            type="file"
            accept="image/png,image/jpeg"
            data-testid="template-input"
            className="sr-only"
            disabled={loading}
            onChange={(event) => {
              const file = event.target.files?.[0]
              // Reset so picking the same file again still fires `change`.
              event.target.value = ''
              if (file) onFile(file)
            }}
          />
        </label>
      </div>
      {!template && templates.status === 'ready' ? <p className="text-sm text-ink-soft">{EVENTS_COPY.templateDefaultHint}</p> : null}
      {error ? (
        <p role="alert" className="text-sm text-danger tabular-nums">
          {error}
        </p>
      ) : null}
    </fieldset>
  )
}
