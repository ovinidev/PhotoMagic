import { useState } from 'react'
import type { GalleryReprintResult } from '@shared/ipc'
import { PRINT_COPY } from '@renderer/features/print'
import { cn } from '@renderer/shared/utils/cn'
import { GLASS } from '@renderer/shared/utils/glass'
import { GALLERY_COPY } from '../copy'
import { GalleryImage } from './GalleryImage'

type Surface = 'tv' | 'laptop'
type Sending = { status: 'idle' } | { status: 'sending' } | { status: 'done'; result: GalleryReprintResult }

function resultText(result: GalleryReprintResult): string {
  if (result.ok) return GALLERY_COPY.sent
  return result.reason === 'missing' ? GALLERY_COPY.missing : PRINT_COPY.failures[result.reason]
}

/**
 * One montage fullscreen (PRD §6.6). The three-dot menu offers `Imprimir novamente`, which resends
 * that same file (one copy, no new file). The TV skin is dark glass with 64 px targets; the laptop
 * skin is the light card.
 */
export function GalleryViewer({ fileName, surface, onClose }: { fileName: string; surface: Surface; onClose: () => void }) {
  const [menuOpen, setMenuOpen] = useState(false)
  const [sending, setSending] = useState<Sending>({ status: 'idle' })
  const tv = surface === 'tv'

  const reprint = () => {
    setMenuOpen(false)
    setSending({ status: 'sending' })
    window.fotomagica.gallery
      .reprint(fileName)
      .then((result) => setSending({ status: 'done', result }))
      .catch(() => setSending({ status: 'done', result: { ok: false, reason: 'failed', detail: '' } }))
  }

  const button = tv
    ? 'flex min-h-16 min-w-16 cursor-pointer items-center justify-center rounded-full px-8 text-3xl font-semibold text-white focus-visible:outline-4 focus-visible:outline-offset-4 focus-visible:outline-white'
    : 'flex min-h-11 min-w-11 cursor-pointer items-center justify-center rounded-[var(--radius-field)] border border-line px-4 text-sm font-medium text-ink hover:bg-bg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink'

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={fileName}
      data-testid="gallery-viewer"
      className={cn('fixed inset-0 z-50 flex flex-col', tv ? 'bg-black gap-10 p-12' : 'bg-bg/95 gap-4 p-8')}
    >
      <div className="relative flex items-center justify-between gap-4">
        <button type="button" onClick={onClose} className={cn(button, tv && GLASS)}>
          {GALLERY_COPY.back}
        </button>
        <p className={cn('font-semibold tabular-nums', tv ? 'text-4xl text-white' : 'text-ink')}>{fileName}</p>
        <div className="relative">
          <button type="button" aria-label={GALLERY_COPY.menu} aria-haspopup="menu" aria-expanded={menuOpen} onClick={() => setMenuOpen((open) => !open)} className={cn(button, tv && GLASS)}>
            <span aria-hidden>⋯</span>
          </button>
          {menuOpen ? (
            <div role="menu" className={cn('absolute right-0 z-10 mt-3 flex flex-col overflow-hidden', tv ? cn('rounded-[32px] p-3', GLASS) : 'rounded-[var(--radius-card)] border border-line bg-bg-raised p-1 shadow-lg')}>
              <button
                type="button"
                role="menuitem"
                onClick={reprint}
                className={cn(
                  'cursor-pointer text-left whitespace-nowrap',
                  tv ? 'min-h-16 px-8 text-3xl font-semibold text-white' : 'min-h-11 rounded-[var(--radius-field)] px-4 text-sm text-ink hover:bg-bg',
                )}
              >
                {GALLERY_COPY.again}
              </button>
            </div>
          ) : null}
        </div>
      </div>
      <div className="flex min-h-0 flex-1 items-center justify-center">
        <GalleryImage fileName={fileName} size="full" dark={tv} className="h-full w-full" />
      </div>
      <p role="status" aria-live="polite" data-testid="gallery-reprint-status" className={cn('min-h-8 text-center', tv ? 'text-3xl text-white' : 'text-sm text-ink')}>
        {sending.status === 'sending' ? GALLERY_COPY.sending : sending.status === 'done' ? resultText(sending.result) : ''}
      </p>
    </div>
  )
}
