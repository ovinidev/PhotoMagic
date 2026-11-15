import { useCallback, useEffect, useId, useMemo, useState } from 'react'
import { PRINT_MODES, SEED_LAYOUTS, crossesCutLine, type Layouts, type PrintMode, type Slot } from '@shared/layout'
import { Button } from '@renderer/shared/components/ui/button'
import { cn } from '@renderer/shared/utils/cn'
import { LAYOUT_COPY } from '../copy'
import { useLayouts } from '../hooks/useLayouts'
import { useTemplatePreview } from '../hooks/useTemplatePreview'
import { canRedo, canUndo, commit, redo, replaceSlot, startHistory, undo, type History } from '../utils/history'
import { createRegistry } from '../utils/livePaint'
import { SheetCanvas } from './SheetCanvas'
import { SlotTable } from './SlotTable'

type SaveState = 'idle' | 'saving' | 'saved' | 'error' | 'event-open'

function EditorBody({ layouts, initialMode, titleId }: { layouts: Layouts; initialMode: PrintMode; titleId: string }) {
  const [mode, setMode] = useState<PrintMode>(initialMode)
  const [histories, setHistories] = useState<Record<PrintMode, History>>(() => ({
    'two-strips': startHistory(layouts['two-strips']),
    'one-strip': startHistory(layouts['one-strip']),
  }))
  const [selected, setSelected] = useState<Record<PrintMode, string | null>>(() => ({
    'two-strips': layouts['two-strips'][0]?.id ?? null,
    'one-strip': layouts['one-strip'][0]?.id ?? null,
  }))
  const [saveState, setSaveState] = useState<SaveState>('idle')
  // One registry per mode: the canvas and the panel of the layout on screen register into it.
  const registry = useMemo(() => createRegistry(), [])
  const templateUrl = useTemplatePreview(mode)
  const history = histories[mode]
  const slots = history.present

  /** Applies a history change to the layout on screen and writes only that layout, once (DESIGN §7). */
  const apply = useCallback(
    (change: (history: History) => History) => {
      const before = histories[mode]
      const after = change(before)
      if (after === before) return
      setHistories((current) => ({ ...current, [mode]: after }))
      setSaveState('saving')
      window.fotomagica.layout
        .save({ mode, slots: [...after.present] })
        .then((result) => setSaveState(result.ok ? 'saved' : result.reason === 'event-open' ? 'event-open' : 'error'))
        .catch(() => setSaveState('error'))
    },
    [mode, histories],
  )

  const commitSlot = useCallback((slot: Slot) => apply((h) => commit(h, replaceSlot(h.present, slot))), [apply])
  const select = useCallback((id: string) => setSelected((current) => (current[mode] === id ? current : { ...current, [mode]: id })), [mode])

  // Ctrl+Z / Ctrl+Shift+Z / Ctrl+Y, outside the number fields (they keep their own text undo).
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (!(event.ctrlKey || event.metaKey)) return
      const target = event.target as HTMLElement | null
      if (target && (target.tagName === 'INPUT' || target.tagName === 'SELECT')) return
      const key = event.key.toLowerCase()
      if (key === 'z' && !event.shiftKey) apply(undo)
      else if ((key === 'z' && event.shiftKey) || key === 'y') apply(redo)
      else return
      event.preventDefault()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [apply])

  const crossing = mode === 'two-strips' ? slots.filter((slot) => crossesCutLine(slot)).map((slot) => LAYOUT_COPY.slotLabel(slot.id)) : []

  return (
    <>
      <header className="flex flex-wrap items-center gap-4 border-b border-line px-6 py-3">
        <div className="mr-auto">
          <h1 id={titleId} className="text-lg font-semibold text-ink">
            {LAYOUT_COPY.title}
          </h1>
          <p className="text-sm text-ink-soft">{LAYOUT_COPY.subtitle}</p>
        </div>
        <div role="radiogroup" aria-label={LAYOUT_COPY.modeSelector} className="flex rounded-[var(--radius-field)] border border-line p-0.5">
          {PRINT_MODES.map((option) => (
            <button
              key={option}
              type="button"
              role="radio"
              aria-checked={mode === option}
              onClick={() => setMode(option)}
              className={cn(
                'min-h-10 min-w-20 cursor-pointer rounded-[6px] px-4 text-sm font-medium',
                'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink',
                mode === option ? 'bg-primary text-primary-ink' : 'text-ink hover:bg-bg',
              )}
            >
              {LAYOUT_COPY.modes[option]}
            </button>
          ))}
        </div>
        <div className="flex gap-2">
          <Button variant="ghost" disabled={!canUndo(history)} onClick={() => apply(undo)}>
            {LAYOUT_COPY.undo}
          </Button>
          <Button variant="ghost" disabled={!canRedo(history)} onClick={() => apply(redo)}>
            {LAYOUT_COPY.redo}
          </Button>
          <Button variant="ghost" onClick={() => apply((h) => commit(h, SEED_LAYOUTS[mode]))}>
            {LAYOUT_COPY.reset}
          </Button>
        </div>
      </header>

      <div className="grid min-h-0 flex-1 grid-cols-[520px_minmax(0,1fr)] gap-6 overflow-auto p-6">
        <aside className="flex flex-col gap-4">
          {/* key: the rows remount per mode, so the fields register the slots on screen. */}
          <SlotTable key={mode} slots={slots} selectedId={selected[mode]} registry={registry} onSelect={select} onCommit={commitSlot} />
          <p
            role="status"
            data-testid="layout-save-state"
            className={cn('min-h-5 text-sm', saveState === 'error' || saveState === 'event-open' ? 'text-danger' : 'text-ink-soft')}
          >
            {saveState === 'saving'
              ? LAYOUT_COPY.saving
              : saveState === 'saved'
                ? LAYOUT_COPY.saved
                : saveState === 'error'
                  ? LAYOUT_COPY.saveError
                  : saveState === 'event-open'
                    ? LAYOUT_COPY.eventOpen
                    : ''}
          </p>
        </aside>
        <section className="flex min-w-0 flex-col gap-3 pb-10">
          <div className="mx-auto w-full" style={{ maxWidth: 'calc((100vh - 230px) * 1844 / 1240)' }}>
            <SheetCanvas
              key={mode}
              mode={mode}
              slots={slots}
              selectedId={selected[mode]}
              templateUrl={templateUrl}
              registry={registry}
              onSelect={select}
              onCommit={commitSlot}
            />
          </div>
          {crossing.length > 0 ? (
            <p role="alert" data-testid="cut-warning" className="mx-auto mt-6 text-sm text-danger">
              {LAYOUT_COPY.cutWarning(crossing)}
            </p>
          ) : null}
        </section>
      </div>
    </>
  )
}

/**
 * Slot editor (PRD §6.2, RF03; DESIGN §7), a full-window dialog over the create-event screen, like the
 * current app's Custom Layout dialog. Opens on the mode being prepared; a selector switches between
 * the two layouts. Every committed change is saved, so `Concluir` only closes.
 */
export function LayoutEditor({ initialMode, onClose }: { initialMode: PrintMode; onClose: () => void }) {
  const titleId = useId()
  const layouts = useLayouts()

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div role="dialog" aria-modal="true" aria-labelledby={titleId} className="fixed inset-0 z-50 flex flex-col bg-bg text-ink">
      {layouts.status === 'ready' ? (
        <EditorBody layouts={layouts.value} initialMode={initialMode} titleId={titleId} />
      ) : (
        <div className="flex flex-1 items-center justify-center">
          <h1 id={titleId} className="sr-only">
            {LAYOUT_COPY.title}
          </h1>
          <p className={cn('text-sm', layouts.status === 'error' ? 'text-danger' : 'text-ink-soft')} role={layouts.status === 'error' ? 'alert' : undefined}>
            {layouts.status === 'error' ? LAYOUT_COPY.loadError : LAYOUT_COPY.loading}
          </p>
        </div>
      )}
      <footer className="flex justify-end border-t border-line px-6 py-3">
        <Button onClick={onClose}>{LAYOUT_COPY.done}</Button>
      </footer>
    </div>
  )
}
