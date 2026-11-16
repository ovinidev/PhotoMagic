import { useRef, type PointerEvent as ReactPointerEvent } from 'react'
import { PRINT_MARGIN, SHEET } from '@shared/constants'
import {
  CUT_LINE_Y,
  RESIZE_HANDLES,
  angleTowards,
  moveSlot,
  resizeSlot,
  roundSlot,
  snapAngle,
  snapMove,
  snapResize,
  type PrintMode,
  type ResizeHandle,
  type Slot,
} from '@shared/layout'
import { cn } from '@renderer/shared/utils/cn'
import { LAYOUT_COPY } from '../copy'
import { paintSlot, slotStyle, type LiveRegistry } from '../utils/livePaint'
import { photoColor } from '../utils/slotColors'
import { SheetGuides } from './SheetGuides'

type Gesture =
  | { kind: 'move'; pointerId: number; origin: Slot; start: { x: number; y: number }; draft: Slot }
  | { kind: 'resize'; pointerId: number; origin: Slot; start: { x: number; y: number }; draft: Slot; handle: ResizeHandle }
  | { kind: 'rotate'; pointerId: number; origin: Slot; start: { x: number; y: number }; draft: Slot }

/** Position of each resize handle on the card, in percent of the unrotated card. */
const HANDLE_POSITION: Record<ResizeHandle, { left: string; top: string; cursor: string }> = {
  nw: { left: '0%', top: '0%', cursor: 'nwse-resize' },
  n: { left: '50%', top: '0%', cursor: 'ns-resize' },
  ne: { left: '100%', top: '0%', cursor: 'nesw-resize' },
  e: { left: '100%', top: '50%', cursor: 'ew-resize' },
  se: { left: '100%', top: '100%', cursor: 'nwse-resize' },
  s: { left: '50%', top: '100%', cursor: 'ns-resize' },
  sw: { left: '0%', top: '100%', cursor: 'nesw-resize' },
  w: { left: '0%', top: '50%', cursor: 'ew-resize' },
}

/**
 * The sheet at its real proportion (1844×1240) with the template behind and one numbered, colored
 * card per slot (DESIGN §6 editor model, §7). The selected card has a dashed red border, 8 resize
 * handles and a rotation handle below its bottom center. Gestures paint the DOM directly
 * (`paintSlot`) and call `onCommit` once, on release.
 */
export function SheetCanvas({
  mode,
  slots,
  selectedId,
  templateUrl,
  registry,
  onSelect,
  onCommit,
}: {
  mode: PrintMode
  slots: readonly Slot[]
  selectedId: string | null
  templateUrl: string | null
  registry: LiveRegistry
  onSelect: (id: string) => void
  onCommit: (slot: Slot) => void
}) {
  const sheetRef = useRef<HTMLDivElement>(null)
  const gesture = useRef<Gesture | null>(null)

  /** Pointer position in sheet pixels. */
  const toSheet = (event: { clientX: number; clientY: number }) => {
    const rect = sheetRef.current!.getBoundingClientRect()
    const scale = rect.width > 0 ? SHEET.width / rect.width : 1
    return { x: (event.clientX - rect.left) * scale, y: (event.clientY - rect.top) * scale }
  }

  const begin = (event: ReactPointerEvent, slot: Slot, kind: Gesture['kind'], handle?: ResizeHandle) => {
    if (event.button !== 0 || gesture.current) return
    event.stopPropagation()
    event.preventDefault()
    onSelect(slot.id)
    sheetRef.current?.setPointerCapture?.(event.pointerId)
    const start = toSheet(event)
    gesture.current =
      kind === 'resize'
        ? { kind, pointerId: event.pointerId, origin: slot, start, draft: slot, handle: handle! }
        : { kind, pointerId: event.pointerId, origin: slot, start, draft: slot }
  }

  const move = (event: ReactPointerEvent) => {
    const current = gesture.current
    if (!current || event.pointerId !== current.pointerId) return
    const point = toSheet(event)
    const delta = { x: point.x - current.start.x, y: point.y - current.start.y }
    const others = slots.filter((slot) => slot.id !== current.origin.id)
    const options = { mode, alt: event.altKey }
    let draft: Slot
    if (current.kind === 'move') draft = snapMove(moveSlot(current.origin, delta), others, options)
    else if (current.kind === 'resize') draft = snapResize(resizeSlot(current.origin, current.handle, delta), current.handle, others, options)
    else draft = { ...current.origin, angle: snapAngle(angleTowards(current.origin, point), options) }
    current.draft = roundSlot(draft)
    paintSlot(registry, current.draft)
  }

  const end = (event: ReactPointerEvent, cancelled: boolean) => {
    const current = gesture.current
    if (!current || event.pointerId !== current.pointerId) return
    gesture.current = null
    sheetRef.current?.releasePointerCapture?.(event.pointerId)
    if (cancelled) paintSlot(registry, current.origin)
    else onCommit(current.draft)
  }

  const crossing = mode === 'two-strips'

  return (
    <div
      ref={sheetRef}
      data-testid="layout-sheet"
      className="relative aspect-[1844/1240] w-full touch-none overflow-visible bg-white shadow-sm ring-1 ring-line [container-type:inline-size]"
      onPointerMove={move}
      onPointerUp={(event) => end(event, false)}
      onPointerCancel={(event) => end(event, true)}
      onLostPointerCapture={(event) => end(event, false)}
    >
      <div className="absolute inset-0 overflow-hidden">
        {templateUrl ? (
          <img src={templateUrl} alt={LAYOUT_COPY.templateAlt(LAYOUT_COPY.modes[mode])} className="h-full w-full select-none" draggable={false} />
        ) : (
          // No template: the montage uses a plain white sheet (PRD §6.1), so the editor shows it too.
          <div className="flex h-full w-full items-end justify-center bg-white p-4" data-testid="layout-white-sheet">
            <p className="text-sm text-ink-soft">{LAYOUT_COPY.noTemplate(LAYOUT_COPY.modes[mode])}</p>
          </div>
        )}
        {/* The standard boxes, under the cards: visible even when the art has no boxes (PRD §6.2). */}
        <SheetGuides mode={mode} />
        {/* Print margins: 22 and 20 px inside the extent (DESIGN §6). */}
        <div
          aria-hidden
          className="pointer-events-none absolute border border-dashed border-ink-soft/40"
          style={{
            left: `${(PRINT_MARGIN.x / SHEET.width) * 100}%`,
            right: `${(PRINT_MARGIN.x / SHEET.width) * 100}%`,
            top: `${(PRINT_MARGIN.y / SHEET.height) * 100}%`,
            bottom: `${(PRINT_MARGIN.y / SHEET.height) * 100}%`,
          }}
        />
        {crossing ? (
          <div
            data-testid="cut-line"
            className="pointer-events-none absolute inset-x-0 border-t-2 border-dashed border-ink/70"
            style={{ top: `${(CUT_LINE_Y / SHEET.height) * 100}%` }}
          >
            <span className="absolute right-2 -translate-y-full rounded bg-bg-raised/90 px-1.5 text-[11px] font-medium text-ink">
              {LAYOUT_COPY.cutLine}
            </span>
          </div>
        ) : null}
      </div>

      {slots.map((slot) => {
        const selected = slot.id === selectedId
        const color = photoColor(slot.photo)
        const label = LAYOUT_COPY.slotLabel(slot.id)
        return (
          <div
            key={slot.id}
            ref={(element) => {
              if (element) registry.cards.set(slot.id, element)
              else registry.cards.delete(slot.id)
            }}
            role="button"
            tabIndex={0}
            aria-label={LAYOUT_COPY.cardLabel(label, slot.photo)}
            aria-pressed={selected}
            data-testid={`slot-card-${slot.id}`}
            data-photo={slot.photo ?? 'none'}
            className={cn(
              'absolute cursor-move outline-none select-none',
              selected ? 'z-20 outline-2 outline-offset-0 outline-dashed outline-selection' : 'z-10 outline-1 outline-ink/30 outline-solid',
            )}
            style={{ ...slotStyle(slot), backgroundColor: `color-mix(in srgb, ${color.fill} 82%, transparent)` }}
            onPointerDown={(event) => begin(event, slot, 'move')}
            onFocus={() => onSelect(slot.id)}
          >
            {/* The number lives in the slot's own space and turns with it, as in the current app. */}
            <span
              aria-hidden
              className="pointer-events-none absolute inset-0 flex items-center justify-center font-semibold"
              style={{ color: selected ? 'var(--selection)' : color.ink, fontSize: '7cqw', lineHeight: 1 }}
            >
              {slot.photo ?? '–'}
            </span>
            {selected ? (
              <>
                {RESIZE_HANDLES.map((handle) => (
                  <span
                    key={handle}
                    data-testid={`handle-${handle}`}
                    aria-hidden
                    className="absolute flex size-6 -translate-x-1/2 -translate-y-1/2 items-center justify-center"
                    style={{ left: HANDLE_POSITION[handle].left, top: HANDLE_POSITION[handle].top, cursor: HANDLE_POSITION[handle].cursor }}
                    onPointerDown={(event) => begin(event, slot, 'resize', handle)}
                  >
                    <span className="size-3 rounded-full border-2 border-selection bg-white" />
                  </span>
                ))}
                {/* Rotation handle: outside the bottom center, tied to the card by a dashed rod. */}
                <span aria-hidden className="pointer-events-none absolute top-1/2 left-1/2 h-[calc(50%+28px)] -translate-x-1/2 border-l-2 border-dashed border-selection" />
                <span
                  data-testid="handle-rotate"
                  aria-label={LAYOUT_COPY.rotate}
                  className="absolute left-1/2 flex size-7 cursor-grab items-center justify-center"
                  style={{ top: 'calc(100% + 28px)', transform: 'translate(-50%, -50%)' }}
                  onPointerDown={(event) => begin(event, slot, 'rotate')}
                >
                  <span className="size-3.5 rounded-full border-2 border-selection bg-white" />
                </span>
              </>
            ) : null}
          </div>
        )
      })}
    </div>
  )
}
