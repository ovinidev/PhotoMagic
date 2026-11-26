import { useCallback, useEffect, useLayoutEffect, useRef, useState, type PointerEvent as ReactPointerEvent, type ReactNode } from 'react'
import { SHEET } from '@shared/constants'
import { LAYOUT_COPY } from '../copy'
import { CANVAS_ZOOM, clampCanvasZoom, fitSheetWidth, scrollForZoom, stepCanvasZoom } from '../utils/canvasZoom'

/** Room around the sheet: the rotation handle sits 28 px below a card, so a bottom card needs space. */
const PAD = { x: 12, top: 16, bottom: 48 } as const

type Pan = { pointerId: number; x: number; y: number }

/**
 * The editor's sheet in a scrollable viewport with its own zoom (DESIGN §7): Ctrl + wheel toward the
 * cursor, back to 100% (fit) at the bottom of the range; there are no zoom buttons. The sheet is laid out at
 * `fit × zoom` CSS pixels, so `SheetCanvas` converts the pointer exactly at any zoom. When zoomed,
 * dragging the background (or the middle button) pans; cards keep their own gestures.
 */
export function ZoomableSheet({ children }: { children: ReactNode }) {
  const viewportRef = useRef<HTMLDivElement>(null)
  const [fit, setFit] = useState(0)
  const [zoom, setZoom] = useState<number>(CANVAS_ZOOM.min)
  const zoomRef = useRef(zoom)
  const pendingScroll = useRef<{ left: number; top: number } | null>(null)
  const pan = useRef<Pan | null>(null)
  // The viewport reserves the scrollbar's width (`scrollbar-gutter: stable`): otherwise a scrollbar that
  // appears while the fit is re-measured narrows the sheet mid-gesture and shifts every card.

  // Fit = the widest 1844×1240 sheet the viewport holds, re-measured when the window or app zoom changes.
  useLayoutEffect(() => {
    const viewport = viewportRef.current
    if (!viewport) return
    const measure = () =>
      setFit(fitSheetWidth({ width: viewport.clientWidth - 2 * PAD.x, height: viewport.clientHeight - PAD.top - PAD.bottom }, SHEET))
    measure()
    if (typeof ResizeObserver === 'undefined') return
    const observer = new ResizeObserver(measure)
    observer.observe(viewport)
    return () => observer.disconnect()
  }, [])

  const applyZoom = useCallback((next: number, anchor?: { x: number; y: number }) => {
    const viewport = viewportRef.current
    const from = zoomRef.current
    const to = clampCanvasZoom(next)
    if (!viewport || to === from) return
    const point = anchor ?? { x: viewport.clientWidth / 2, y: viewport.clientHeight / 2 }
    pendingScroll.current = {
      left: scrollForZoom(viewport.scrollLeft, point.x, from, to),
      top: scrollForZoom(viewport.scrollTop, point.y, from, to),
    }
    zoomRef.current = to
    setZoom(to)
  }, [])

  // After the sheet has its new size, scroll so the anchor point stays under the cursor.
  useLayoutEffect(() => {
    const viewport = viewportRef.current
    const scroll = pendingScroll.current
    if (!viewport || !scroll) return
    pendingScroll.current = null
    viewport.scrollLeft = scroll.left
    viewport.scrollTop = scroll.top
  }, [zoom])

  // Ctrl + wheel zooms the sheet, not the app: React's wheel listener is passive, so attach natively
  // and `preventDefault`, which also tells the app-wide zoom to leave this wheel alone.
  useEffect(() => {
    const viewport = viewportRef.current
    if (!viewport) return
    const onWheel = (event: WheelEvent) => {
      if (!event.ctrlKey || event.deltaY === 0) return
      event.preventDefault()
      const rect = viewport.getBoundingClientRect()
      applyZoom(stepCanvasZoom(zoomRef.current, event.deltaY < 0 ? 'in' : 'out'), { x: event.clientX - rect.left, y: event.clientY - rect.top })
    }
    viewport.addEventListener('wheel', onWheel, { passive: false })
    return () => viewport.removeEventListener('wheel', onWheel)
  }, [applyZoom])

  // A pointer that reaches the viewport did not start on a card (cards stop propagation).
  const startPan = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (zoomRef.current <= CANVAS_ZOOM.min || (event.button !== 0 && event.button !== 1)) return
    event.preventDefault()
    viewportRef.current?.setPointerCapture?.(event.pointerId)
    pan.current = { pointerId: event.pointerId, x: event.clientX, y: event.clientY }
  }
  const movePan = (event: ReactPointerEvent<HTMLDivElement>) => {
    const current = pan.current
    const viewport = viewportRef.current
    if (!current || !viewport || event.pointerId !== current.pointerId) return
    viewport.scrollLeft -= event.clientX - current.x
    viewport.scrollTop -= event.clientY - current.y
    pan.current = { ...current, x: event.clientX, y: event.clientY }
  }
  const endPan = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (pan.current?.pointerId === event.pointerId) pan.current = null
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-1">
      <p className="text-right text-xs text-ink-soft">{LAYOUT_COPY.canvasZoomHint}</p>
      <div
        ref={viewportRef}
        data-testid="layout-viewport"
        data-zoom={zoom}
        aria-label={LAYOUT_COPY.canvasZoom}
        className={`relative min-h-0 flex-1 overflow-auto [scrollbar-gutter:stable] [scrollbar-width:thin] rounded-[var(--radius-field)] border border-line bg-bg ${zoom > CANVAS_ZOOM.min ? 'cursor-grab' : ''}`}
        onPointerDown={startPan}
        onPointerMove={movePan}
        onPointerUp={endPan}
        onPointerCancel={endPan}
      >
        <div
          className="mx-auto box-content"
          style={{ width: fit > 0 ? `${fit * zoom}px` : '100%', padding: `${PAD.top}px ${PAD.x}px ${PAD.bottom}px` }}
        >
          {children}
        </div>
      </div>
    </div>
  )
}
