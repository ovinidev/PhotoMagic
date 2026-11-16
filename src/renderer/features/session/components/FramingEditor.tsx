import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent, type ReactNode } from 'react'
import { SHEET } from '@shared/constants'
import type { EventSession } from '@shared/ipc'
import {
  DEFAULT_FRAMING,
  panFraming,
  photoInBox,
  photoPlacement,
  photoPlacementCss,
  planSlot,
  rotateFraming,
  turnFraming,
  wheelZoomFactor,
  zoomFraming,
  type Framing,
  type GuideBox,
  type PrintMode,
  type Slot,
} from '@shared/layout'
import { LAYOUT_COPY } from '@renderer/features/layout'
import { Button } from '@renderer/shared/components/ui/button'
import { cn } from '@renderer/shared/utils/cn'
import { SESSION_COPY } from '../copy'
import { useFramingSender } from '../hooks/useFramingSender'
import { useRoundPhotos, type RoundPhoto } from '../hooks/useRoundPhotos'

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

/** A rounded corner of `radius` sheet px as a CSS radius, in percent of a `width × height` box. */
function cssRadius(radius: number, width: number, height: number): string | undefined {
  const r = Math.min(radius, width / 2, height / 2)
  return r > 0 ? `${pct(r, width)} / ${pct(r, height)}` : undefined
}

/** The slot's rounded corners as a CSS radius, in percent of the box so it scales with the preview. */
function cornerRadius(slot: Slot): string | undefined {
  return cssRadius(slot.radius ?? 0, slot.width, slot.height)
}

/**
 * The capture placed in one slot by the same plan the composer runs (`planSlot` then
 * `photoPlacement`), drawn inside a box the size of the slot, turned by its angle and clipped to its
 * rounded corners. Positioned in percent of the fixed `box` it sits in.
 */
function PlacedPhoto({ slot, box, photo, framing, testId }: { slot: Slot; box: GuideBox; photo: RoundPhoto; framing: Framing; testId: string }) {
  const css = photoPlacementCss(photoPlacement(planSlot(slot, photo, framing)), slot)
  return (
    <span
      className="absolute overflow-hidden"
      style={{
        left: pct(slot.left - box.rect.left, box.rect.width),
        top: pct(slot.top - box.rect.top, box.rect.height),
        width: pct(slot.width, box.rect.width),
        height: pct(slot.height, box.rect.height),
        transform: `rotate(${slot.angle}deg)`,
        borderRadius: cornerRadius(slot),
      }}
    >
      <img
        src={photo.url}
        alt=""
        draggable={false}
        data-testid={testId}
        className="absolute top-1/2 left-1/2 max-w-none select-none"
        style={{ width: css.width, height: css.height, transform: css.transform }}
      />
    </span>
  )
}

/**
 * One slot's photo as the montage draws it (DESIGN §6): exactly one photo per fixed gray box
 * (`photoInBox`), covering the whole box and clipped to its rounded corners, whatever the card's own
 * position and size. Drawn here so a drag follows the pointer without waiting for main.
 */
function BoxPhoto({ mode, boxes, slot, index, photo, framing }: { mode: PrintMode; boxes: readonly GuideBox[] | null; slot: Slot; index: number; photo: RoundPhoto; framing: Framing }) {
  const placed = photoInBox(mode, slot, index, framing, boxes)
  if (!placed) return null
  const { box } = placed
  return (
    <span
      data-testid="framing-photo-mask"
      data-mask-for={slot.id}
      className="pointer-events-none absolute overflow-hidden"
      style={{
        left: pct(box.rect.left, SHEET.width),
        top: pct(box.rect.top, SHEET.height),
        width: pct(box.rect.width, SHEET.width),
        height: pct(box.rect.height, SHEET.height),
        borderRadius: cssRadius(box.radius, box.rect.width, box.rect.height),
      }}
    >
      <PlacedPhoto slot={placed.slot} box={box} photo={photo} framing={placed.framing} testId="framing-photo" />
    </span>
  )
}

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
  const photos = useRoundPhotos(session.taken)
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
  const apply = (slotId: string, framing: Framing, final = false) => {
    setDrafts((current) => ({ ...current, [slotId]: framing }))
    send(slotId, framing, { final })
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
    // Pan and turn on the slot the photo is planned on (its box), so a drag moves the photo 1:1.
    const index = session.slots.findIndex((each) => each.id === slot.id)
    const onBox = photoInBox(session.mode, slot, index, DEFAULT_FRAMING, session.boxes)?.slot ?? slot
    gesture.current = { kind, slot: onBox, origin: framingOf(slot.id), start: toSheet(event), pointerId: event.pointerId }
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
    const active = gesture.current
    if (active?.pointerId !== event.pointerId) return
    gesture.current = null
    // The last framing of the gesture goes to main now, not after the throttle.
    apply(active.slot.id, framingOf(active.slot.id), true)
  }

  const current = selectedSlot ? framingOf(selectedSlot.id) : null
  const step = (change: (framing: Framing) => Framing) => {
    if (selectedSlot && current) apply(selectedSlot.id, change(current), true)
  }

  const overlay = (
      <div ref={overlayRef} data-testid="framing-overlay" className="absolute inset-0">
        {filled.map((slot) => {
          const photo = slot.photo === null ? undefined : photos[slot.photo]
          const index = session.slots.findIndex((each) => each.id === slot.id)
          return photo ? <BoxPhoto key={`photo-${slot.id}`} mode={session.mode} boxes={session.boxes} slot={slot} index={index} photo={photo} framing={framingOf(slot.id)} /> : null
        })}
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
              className="group absolute cursor-move touch-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
              style={{
                left: pct(slot.left, SHEET.width),
                top: pct(slot.top, SHEET.height),
                width: pct(slot.width, SHEET.width),
                height: pct(slot.height, SHEET.height),
                transform: `rotate(${slot.angle}deg)`,
              }}
            >
              <span
                aria-hidden
                className={cn(
                  'pointer-events-none absolute inset-0',
                  isSelected ? 'border-2 border-ink' : 'border border-white/70 group-hover:border-ink/70',
                )}
                style={{ borderRadius: cornerRadius(slot) }}
              />
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

