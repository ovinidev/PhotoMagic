import { useId } from 'react'
import type { TemplateInfo } from '@shared/ipc'
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
  modeLabel,
  templates,
  template,
  importState,
  onFile,
}: {
  modeLabel: string
  templates: TemplatesView
  template: TemplateInfo | null
  importState: ImportState
  onFile: (file: File) => void
}) {
  const inputId = useId()
  const url = useObjectUrl(template?.preview ?? null)
  const error = rejection(importState)
  const loading = importState.status === 'loading'

  return (
    <fieldset className="flex flex-col gap-3">
      <legend className="mb-2 text-sm font-medium text-ink">{EVENTS_COPY.template(modeLabel)}</legend>
      <div className="flex aspect-[1844/1240] w-full items-center justify-center overflow-hidden rounded-[var(--radius-field)] border border-line bg-bg">
        {templates.status === 'loading' ? (
          <p className="text-sm text-ink-soft">{EVENTS_COPY.templatesLoading}</p>
        ) : templates.status === 'error' ? (
          <p className="text-sm text-danger">{EVENTS_COPY.templatesError}</p>
        ) : url ? (
          <img src={url} alt={EVENTS_COPY.templatePreviewAlt(modeLabel)} data-testid="template-preview" className="h-full w-full object-contain" draggable={false} />
        ) : (
          <p className="max-w-[360px] px-6 text-center text-sm text-ink-soft">{EVENTS_COPY.templateEmpty(modeLabel)}</p>
        )}
      </div>
      <div className="flex items-center justify-between gap-4">
        <p className="truncate text-sm text-ink-soft" data-testid="template-file-name">
          {template ? `${template.fileName} · ${template.width} × ${template.height} px` : ''}
        </p>
        <label
          htmlFor={inputId}
          aria-disabled={loading}
          className={cn(
            'inline-flex min-h-11 shrink-0 cursor-pointer items-center rounded-[var(--radius-field)] border border-line px-5 text-sm font-medium text-ink hover:bg-bg',
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
      {error ? (
        <p role="alert" className="text-sm text-danger tabular-nums">
          {error}
        </p>
      ) : null}
    </fieldset>
  )
}
