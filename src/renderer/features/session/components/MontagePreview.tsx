import { useMontagePreview } from '@renderer/shared/hooks/useMontagePreview'
import { SESSION_COPY } from '../copy'

/** The round's montage, filled in as photos come in (PRD §6.3). The same JPEG the TV shows. */
export function MontagePreview({ revision }: { revision: number }) {
  const preview = useMontagePreview(revision)
  return (
    <figure className="flex flex-col gap-3">
      <figcaption className="text-sm font-medium text-ink">{SESSION_COPY.montage}</figcaption>
      <div className="flex aspect-[1844/1240] w-full items-center justify-center overflow-hidden rounded-[var(--radius-card)] border border-line bg-bg">
        {preview.status === 'ready' && preview.url ? (
          <img src={preview.url} alt={SESSION_COPY.montageAlt} data-testid="montage-preview" className="h-full w-full object-contain" draggable={false} />
        ) : (
          <p role="status" className={preview.status === 'error' ? 'text-sm text-danger' : 'text-sm text-ink-soft'}>
            {preview.status === 'error' ? SESSION_COPY.montageError : SESSION_COPY.montageLoading}
          </p>
        )}
      </div>
    </figure>
  )
}
