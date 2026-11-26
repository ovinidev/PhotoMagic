import { useState } from 'react'
import { GALLERY_COPY } from '../copy'
import { useGallery } from '../hooks/useGallery'
import { GalleryImage } from './GalleryImage'
import { GalleryViewer } from './GalleryViewer'
import { montageTime } from '../utils/montageTime'

/** The laptop gallery (PRD §6.3, §6.6): the event's montages, newest first; a click opens one fullscreen. */
export function GalleryPanel() {
  const gallery = useGallery()
  const [viewing, setViewing] = useState<string | null>(null)

  return (
    <section aria-label={GALLERY_COPY.title} data-testid="laptop-gallery" className="flex flex-col gap-4 rounded-[var(--radius-card)] border border-line bg-bg-raised p-6">
      <h2 className="eyebrow">{GALLERY_COPY.title}</h2>
      {gallery.status === 'loading' ? <p className="text-sm text-ink-soft">{GALLERY_COPY.loading}</p> : null}
      {gallery.status === 'error' ? <p className="text-sm text-danger">{GALLERY_COPY.error}</p> : null}
      {gallery.status === 'ready' && gallery.fileNames.length === 0 ? <p className="text-sm text-ink-soft">{GALLERY_COPY.empty}</p> : null}
      {gallery.status === 'ready' && gallery.fileNames.length > 0 ? (
        <ul className="grid grid-cols-3 gap-4">
          {gallery.fileNames.map((fileName) => (
            <li key={fileName}>
              <button
                type="button"
                aria-label={GALLERY_COPY.openItem(fileName)}
                onClick={() => setViewing(fileName)}
                className="flex min-h-11 w-full cursor-pointer flex-col gap-2 text-xs text-ink-soft focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
              >
                <GalleryImage fileName={fileName} size="thumb" className="aspect-[1844/1240] w-full rounded-[var(--radius-field)] border border-line bg-bg" />
                <span className="tabular-nums">{montageTime(fileName)}</span>
              </button>
            </li>
          ))}
        </ul>
      ) : null}
      {viewing ? <GalleryViewer fileName={viewing} surface="laptop" onClose={() => setViewing(null)} /> : null}
    </section>
  )
}
