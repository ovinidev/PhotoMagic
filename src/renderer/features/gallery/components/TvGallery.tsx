import { useState } from 'react'
import { createPortal } from 'react-dom'
import { cn } from '@renderer/shared/utils/cn'
import { GLASS } from '@renderer/shared/utils/glass'
import { GALLERY_COPY } from '../copy'
import { useGallery } from '../hooks/useGallery'
import { GalleryImage } from './GalleryImage'
import { GalleryViewer } from './GalleryViewer'

/**
 * The TV gallery (PRD §6.4, §6.6): the 128 px round thumbnail of the last montage, bottom left, and,
 * when tapped, the grid of the event's montages over the camera. Tapping one opens it fullscreen.
 * The overlays go to `document.body`: the glass bar's `backdrop-filter` would otherwise make
 * `position: fixed` relative to the bar instead of the screen.
 */
export function TvGallery() {
  const gallery = useGallery()
  const [open, setOpen] = useState(false)
  const [viewing, setViewing] = useState<string | null>(null)
  const fileNames = gallery.status === 'ready' ? gallery.fileNames : []
  const last = fileNames[0] ?? null

  return (
    <>
      <button
        type="button"
        aria-label={GALLERY_COPY.open}
        data-testid="tv-gallery-thumb"
        onClick={() => setOpen(true)}
        className="flex size-32 cursor-pointer items-center justify-center overflow-hidden rounded-full border-4 border-white/80 bg-white/10 focus-visible:outline-4 focus-visible:outline-offset-4 focus-visible:outline-white"
      >
        {last ? <GalleryImage key={last} fileName={last} size="thumb" dark className="size-full object-cover" /> : null}
      </button>
      {open
        ? createPortal(
        <div role="dialog" aria-modal="true" aria-label={GALLERY_COPY.title} data-testid="tv-gallery" className="fixed inset-0 z-40 flex flex-col gap-10 bg-black/90 p-12">
          <div className="flex items-center justify-between">
            <p className="text-5xl font-semibold text-white">{GALLERY_COPY.title}</p>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className={cn('min-h-16 min-w-16 cursor-pointer rounded-full px-8 text-3xl font-semibold text-white focus-visible:outline-4 focus-visible:outline-white', GLASS)}
            >
              {GALLERY_COPY.close}
            </button>
          </div>
          {gallery.status === 'loading' ? <p className="text-3xl text-white/80">{GALLERY_COPY.loading}</p> : null}
          {gallery.status === 'error' ? <p className="text-3xl text-white/80">{GALLERY_COPY.error}</p> : null}
          {gallery.status === 'ready' && fileNames.length === 0 ? <p className="text-3xl text-white/80">{GALLERY_COPY.empty}</p> : null}
          <ul className="grid grid-cols-2 gap-8 overflow-y-auto">
            {fileNames.map((fileName) => (
              <li key={fileName}>
                <button
                  type="button"
                  aria-label={GALLERY_COPY.openItem(fileName)}
                  onClick={() => setViewing(fileName)}
                  className="flex w-full cursor-pointer flex-col gap-3 text-2xl text-white focus-visible:outline-4 focus-visible:outline-white"
                >
                  <GalleryImage fileName={fileName} size="thumb" dark className="aspect-[1844/1240] w-full rounded-[24px] bg-white/10" />
                  <span className="tabular-nums">{fileName}</span>
                </button>
              </li>
            ))}
          </ul>
        </div>,
            document.body,
          )
        : null}
      {viewing ? createPortal(<GalleryViewer fileName={viewing} surface="tv" onClose={() => setViewing(null)} />, document.body) : null}
    </>
  )
}
