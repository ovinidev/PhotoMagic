import { useCallback, useEffect, useId, useMemo, useState } from 'react'
import { PRINT_MODES, SEED_LAYOUTS, crossesCutLine, type PrintMode, type Slot } from '@shared/layout'
import { Button } from '@renderer/shared/components/ui/button'
import { cn } from '@renderer/shared/utils/cn'
import { LAYOUT_COPY } from '../copy'
import { useLayouts, type EditorData } from '../hooks/useLayouts'
import { useTemplatePreview } from '../hooks/useTemplatePreview'
import { boxItemsOf, boxesOf, cardsOf, isBoxId, joinItems } from '../utils/boxes'
import { canRedo, canUndo, commit, redo, replaceSlot, sameSlots, startHistory, undo, type History } from '../utils/history'
import { createRegistry } from '../utils/livePaint'
import { SheetCanvas } from './SheetCanvas'
import { SlotTable } from './SlotTable'
import { ZoomableSheet } from './ZoomableSheet'

type SaveState = 'idle' | 'saving' | 'saved' | 'error' | 'event-open'

type Target = 'cards' | 'boxes'
const TARGETS: readonly Target[] = ['cards', 'boxes']

/** Writes what a change touched: the cards to `layout:save`, the fixed boxes to `boxes:save`. */
async function saveChange(mode: PrintMode, before: readonly Slot[], after: readonly Slot[]): Promise<SaveState> {
  const saves: Promise<{ ok: true } | { ok: false; reason: 'event-open' | 'failed' }>[] = []
  if (!sameSlots(cardsOf(before), cardsOf(after))) saves.push(window.fotomagica.layout.save({ mode, slots: cardsOf(after) }))
  if (!sameSlots(boxItemsOf(before), boxItemsOf(after))) saves.push(window.fotomagica.layout.saveBoxes({ mode, boxes: boxesOf(after) }))
  const results = await Promise.all(saves)
  const failed = results.find((result) => !result.ok)
  return !failed || failed.ok ? 'saved' : failed.reason === 'event-open' ? 'event-open' : 'error'
}

function EditorBody({ data, initialMode, titleId }: { data: EditorData; initialMode: PrintMode; titleId: string }) {
  const { layouts, boxes } = data
  const [mode, setMode] = useState<PrintMode>(initialMode)
  // One list per mode, cards then fixed boxes (`box:<id>`), so one Undo covers both.
  const [histories, setHistories] = useState<Record<PrintMode, History>>(() => ({
    'two-strips': startHistory(joinItems(layouts['two-strips'], boxes['two-strips'].boxes)),
    'one-strip': startHistory(joinItems(layouts['one-strip'], boxes['one-strip'].boxes)),
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
  const items = history.present
  const slots = cardsOf(items)
  const boxItems = boxItemsOf(items)
  const selectedId = selected[mode]
  const target: Target = selectedId !== null && isBoxId(selectedId) ? 'boxes' : 'cards'

  /** Applies a history change to the layout on screen and writes only that layout, once (DESIGN §7). */
  const apply = useCallback(
    (change: (history: History) => History) => {
      const before = histories[mode]
      const after = change(before)
      if (after === before) return
      setHistories((current) => ({ ...current, [mode]: after }))
      setSaveState('saving')
      saveChange(mode, before.present, after.present)
        .then(setSaveState)
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

  const crossing = mode === 'two-strips' ? items.filter((slot) => crossesCutLine(slot)).map((slot) => LAYOUT_COPY.itemLabel(slot.id)) : []
  const pickTarget = (next: Target) => {
    const first = (next === 'boxes' ? boxItems : slots)[0]
    if (first && next !== target) select(first.id)
  }

  return (
    <>
      <header className="flex flex-wrap items-center gap-3 border-b border-line px-4 py-2">
        <div className="mr-auto">
          <h1 id={titleId} className="font-display text-2xl text-ink">
            {LAYOUT_COPY.title}
          </h1>
          <p className="text-xs text-ink-soft">{LAYOUT_COPY.subtitle}</p>
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
                'h-7 min-w-16 cursor-pointer rounded-[6px] px-3 text-[13px] font-medium',
                'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink',
                mode === option ? 'bg-primary text-primary-ink' : 'text-ink hover:bg-bg',
              )}
            >
              {LAYOUT_COPY.modes[option]}
            </button>
          ))}
        </div>
        <div role="radiogroup" aria-label={LAYOUT_COPY.editTarget} className="flex rounded-[var(--radius-field)] border border-line p-0.5">
          {TARGETS.map((option) => (
            <button
              key={option}
              type="button"
              role="radio"
              aria-checked={target === option}
              onClick={() => pickTarget(option)}
              className={cn(
                'h-7 min-w-16 cursor-pointer rounded-[6px] px-3 text-[13px] font-medium',
                'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink',
                target === option ? 'bg-primary text-primary-ink' : 'text-ink hover:bg-bg',
              )}
            >
              {LAYOUT_COPY.targets[option]}
            </button>
          ))}
        </div>
        <div className="flex gap-2">
          <Button variant="ghost" size="sm" disabled={!canUndo(history)} onClick={() => apply(undo)}>
            {LAYOUT_COPY.undo}
          </Button>
          <Button variant="ghost" size="sm" disabled={!canRedo(history)} onClick={() => apply(redo)}>
            {LAYOUT_COPY.redo}
          </Button>
          <Button variant="ghost" size="sm" onClick={() => apply((h) => commit(h, joinItems(SEED_LAYOUTS[mode], boxes[mode].defaults)))}>
            {LAYOUT_COPY.reset}
          </Button>
        </div>
      </header>

      <div className="grid min-h-0 flex-1 grid-cols-[400px_minmax(0,1fr)] grid-rows-[minmax(0,1fr)] gap-3 p-3">
        <aside className="flex min-h-0 flex-col gap-2 overflow-auto">
          {/* key: the rows remount per mode, so the fields register the slots on screen. */}
          <h2 className="px-1 text-xs font-semibold text-ink">{LAYOUT_COPY.cardsHeading}</h2>
          <SlotTable key={mode} slots={slots} selectedId={selectedId} registry={registry} onSelect={select} onCommit={commitSlot} />
          <h2 className="mt-2 px-1 text-xs font-semibold text-ink">{LAYOUT_COPY.boxesHeading}</h2>
          <p className="px-1 text-xs text-ink-soft">{LAYOUT_COPY.boxesHint}</p>
          <SlotTable key={`${mode}-boxes`} variant="boxes" slots={boxItems} selectedId={selectedId} registry={registry} onSelect={select} onCommit={commitSlot} />
          <p
            role="status"
            data-testid="layout-save-state"
            className={cn('min-h-5 text-xs', saveState === 'error' || saveState === 'event-open' ? 'text-danger' : 'text-ink-soft')}
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
        <section className="flex min-h-0 min-w-0 flex-col gap-2">
          <ZoomableSheet key={mode}>
            <SheetCanvas
              key={mode}
              mode={mode}
              slots={slots}
              boxes={boxItems}
              selectedId={selectedId}
              templateUrl={templateUrl}
              registry={registry}
              onSelect={select}
              onCommit={commitSlot}
            />
          </ZoomableSheet>
          {crossing.length > 0 ? (
            <p role="alert" data-testid="cut-warning" className="mx-auto text-sm text-danger">
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
        <EditorBody data={layouts.value} initialMode={initialMode} titleId={titleId} />
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
      <footer className="flex justify-end border-t border-line px-4 py-2">
        <Button size="sm" onClick={onClose}>
          {LAYOUT_COPY.done}
        </Button>
      </footer>
    </div>
  )
}
