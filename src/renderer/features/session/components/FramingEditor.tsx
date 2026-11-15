import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent, type ReactNode } from 'react'
import { SHEET } from '@shared/constants'
import type { EventSession } from '@shared/ipc'
import { DEFAULT_FRAMING, panFraming, rotateFraming, turnFraming, wheelZoomFactor, zoomFraming, type Framing, type Slot } from '@shared/layout'
import { LAYOUT_COPY } from '@renderer/features/layout'
import { Button } from '@renderer/shared/components/ui/button'
import { cn } from '@renderer/shared/utils/cn'
import { SESSION_COPY } from '../copy'
import { useFramingSender } from '../hooks/useFramingSender'

type Point = { x: number; y: number }
type Gesture = { kind: 'pan' | 'rotate'; slot: Slot; origin: Framing; start: Point; pointerId: number }

/** Framing is allowed on a filled slot until the montage is written (main refuses it after). */
export function canFrame(session: EventSession): boolean {
  const { phase } = session
  return phase.kind === 'capturing' || phase.kind === 'review' || (phase.kind === 'print-failed' && phase.fileName === null)
}

/** Slots whose photo is already taken in this round. */
function filledSlots(session: EventSession): Slot[] {
  return session.slots.filter((slot) => slot.photo !== null && slot.photo <= session.taken)
}

const pct = (value: number, total: number) => `${(value / total) * 100}%`

/**
 * Round framing on the laptop (RF09, DESIGN §8), drawn over the montage preview. The slots stay
 * still: clicking a filled slot selects it, dragging moves the photo inside, the wheel zooms, and the
 * small ink handle below the slot turns the photo (snaps to 0° within 3°, Alt turns snap off).
 * The buttons do the same in steps. Each slot has its own framing, also when two share a capture.
 * Changes go to main, which recomposes the preview the TV shows. Returns the overlay (drawn over
 * the montage image) and the controls (under it), which share the selection.
 */
export function useFramingEditor(session: EventSession): { overlay: ReactNode; controls: ReactNode } {
  const overlayRef = useRef<HTMLDivElement>(null)
  const gesture = useRef<Gesture | null>(null)
  const send = useFramingSender()
  const [selected, setSelected] = useState<string | null>(null)
  const [drafts, setDrafts] = useState<Record<string, Framing>>({})
  const enabled = canFrame(session)
  const filled = enabled ? filledSlots(session) : []
  const selectedSlot = filled.find((slot) => slot.id === selected) ?? null

  // A new round (or a cancel) starts every slot at the default framing again.
  const fresh = session.taken === 0
  const [wasFresh, setWasFresh] = useState(fresh)
  if (fresh !== wasFresh) {
    setWasFresh(fresh)
    if (fresh) {
      setDrafts({})
      setSelected(null)
    }
  }

  const framingOf = (slotId: string): Framing => drafts[slotId] ?? session.framings[slotId] ?? DEFAULT_FRAMING
  const apply = (slotId: string, framing: Framing) => {
    setDrafts((current) => ({ ...current, [slotId]: framing }))
    send(slotId, framing)
  }

  // Wheel zoom needs a non-passive listener to keep the page from scrolling.
  const wheelState = useRef({ filled, framingOf, apply })
  useEffect(() => {
    wheelState.current = { filled, framingOf, apply }
  })
  useEffect(() => {
    const overlay = overlayRef.current
    if (!overlay) return
    const onWheel = (event: WheelEvent) => {
      const target = (event.target as HTMLElement | null)?.closest<HTMLElement>('[data-slot-id]')
      const slotId = target?.dataset.slotId
      const { filled: slots, framingOf: current, apply: change } = wheelState.current
      if (!slotId || !slots.some((slot) => slot.id === slotId)) return
      event.preventDefault()
      setSelected(slotId)
      change(slotId, zoomFraming(current(slotId), wheelZoomFactor(event.deltaY)))
    }
    overlay.addEventListener('wheel', onWheel, { passive: false })
    return () => overlay.removeEventListener('wheel', onWheel)
  }, [])

  const toSheet = (event: { clientX: number; clientY: number }): Point => {
    const rect = overlayRef.current?.getBoundingClientRect()
    if (!rect || rect.width === 0) return { x: 0, y: 0 }
    return { x: ((event.clientX - rect.left) / rect.width) * SHEET.width, y: ((event.clientY - rect.top) / rect.height) * SHEET.height }
  }

  const begin = (kind: Gesture['kind'], slot: Slot) => (event: ReactPointerEvent<HTMLElement>) => {
    if (event.button !== 0) return
    event.stopPropagation()
    setSelected(slot.id)
    event.currentTarget.setPointerCapture?.(event.pointerId)
    gesture.current = { kind, slot, origin: framingOf(slot.id), start: toSheet(event), pointerId: event.pointerId }
  }

  const move = (event: ReactPointerEvent<HTMLElement>) => {
    const active = gesture.current
    if (!active || active.pointerId !== event.pointerId) return
    const point = toSheet(event)
    const next =
      active.kind === 'pan'
        ? panFraming(active.origin, active.slot, { x: point.x - active.start.x, y: point.y - active.start.y })
        : rotateFraming(active.origin, active.slot, active.start, point, { alt: event.altKey })
    apply(active.slot.id, next)
  }

  const end = (event: ReactPointerEvent<HTMLElement>) => {
    if (gesture.current?.pointerId === event.pointerId) gesture.current = null
  }

  const current = selectedSlot ? framingOf(selectedSlot.id) : null
  const step = (change: (framing: Framing) => Framing) => {
    if (selectedSlot && current) apply(selectedSlot.id, change(current))
  }

  const overlay = (
      <div ref={overlayRef} data-testid="framing-overlay" className="absolute inset-0">
        {filled.map((slot) => {
          const isSelected = slot.id === selected
          const label = LAYOUT_COPY.slotLabel(slot.id)
          return (
            <button
              key={slot.id}
              type="button"
              data-slot-id={slot.id}
              aria-label={SESSION_COPY.framing.slot(label)}
              aria-pressed={isSelected}
              onPointerDown={begin('pan', slot)}
              onPointerMove={move}
              onPointerUp={end}
              onPointerCancel={end}
              className={cn(
                'absolute cursor-move touch-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink',
                isSelected ? 'border-2 border-ink' : 'border border-white/70 hover:border-ink/70',
              )}
              style={{
                left: pct(slot.left, SHEET.width),
                top: pct(slot.top, SHEET.height),
                width: pct(slot.width, SHEET.width),
                height: pct(slot.height, SHEET.height),
                transform: `rotate(${slot.angle}deg)`,
              }}
            >
              {isSelected ? (
                <span
                  role="presentation"
                  data-testid="framing-rotate-handle"
                  onPointerDown={begin('rotate', slot)}
                  onPointerMove={move}
                  onPointerUp={end}
                  onPointerCancel={end}
                  className="absolute top-full left-1/2 mt-3 size-5 -translate-x-1/2 cursor-grab rounded-full border-2 border-white bg-ink shadow"
                />
              ) : null}
            </button>
          )
        })}
      </div>
  )

  const controls = enabled ? (
    <div data-testid="framing-controls" className="flex flex-col gap-3">
      <p data-testid="framing-readout" role="status" className="text-sm text-ink-soft tabular-nums">
        {selectedSlot && current
          ? SESSION_COPY.framing.readout(LAYOUT_COPY.slotLabel(selectedSlot.id), current.zoom, current.rotation)
          : filled.length > 0
            ? SESSION_COPY.framing.hint
            : SESSION_COPY.framing.empty}
      </p>
      <div className="flex flex-wrap gap-2">
        <Button variant="ghost" disabled={!current} onClick={() => step((framing) => zoomFraming(framing, 1.25))}>
          {SESSION_COPY.framing.zoomIn}
        </Button>
        <Button variant="ghost" disabled={!current} onClick={() => step((framing) => zoomFraming(framing, 0.8))}>
          {SESSION_COPY.framing.zoomOut}
        </Button>
        <Button variant="ghost" disabled={!current} onClick={() => step((framing) => turnFraming(framing, -5, { alt: true }))}>
          {SESSION_COPY.framing.turnLeft}
        </Button>
        <Button variant="ghost" disabled={!current} onClick={() => step((framing) => turnFraming(framing, 5, { alt: true }))}>
          {SESSION_COPY.framing.turnRight}
        </Button>
        <Button variant="ghost" disabled={!current} onClick={() => step(() => DEFAULT_FRAMING)}>
          {SESSION_COPY.framing.reset}
        </Button>
      </div>
    </div>
  ) : null

  return { overlay, controls }
}

