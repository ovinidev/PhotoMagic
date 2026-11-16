import { useCallback, useEffect, useLayoutEffect, useRef, useState, type PointerEvent as ReactPointerEvent, type ReactNode } from 'react'
import { SHEET } from '@shared/constants'
import { LAYOUT_COPY } from '../copy'
import { CANVAS_ZOOM, clampCanvasZoom, fitSheetWidth, scrollForZoom, stepCanvasZoom } from '../utils/canvasZoom'

/** Room around the sheet: the rotation handle sits 28 px below a card, so a bottom card needs space. */
const PAD = { x: 16, top: 16, bottom: 48 } as const

type Pan = { pointerId: number; x: number; y: number }

/**
 * The editor's sheet in a scrollable viewport with its own zoom (DESIGN §7): `−` / `+`, the
 * percentage to fit again, and Ctrl + wheel toward the cursor. The sheet is laid out at
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

  const percent = Math.round(zoom * 100)
  const tool =
    'inline-flex min-h-11 min-w-11 cursor-pointer items-center justify-center rounded-[var(--radius-field)] border border-line bg-bg-raised px-3 text-base font-medium text-ink hover:bg-bg disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink'

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-2">
      <div role="group" aria-label={LAYOUT_COPY.canvasZoom} className="flex items-center justify-end gap-1">
        <span className="mr-2 text-sm text-ink-soft">{LAYOUT_COPY.canvasZoomHint}</span>
        <button type="button" className={tool} aria-label={LAYOUT_COPY.canvasZoomOut} disabled={zoom <= CANVAS_ZOOM.min} onClick={() => applyZoom(stepCanvasZoom(zoom, 'out'))}>
          −
        </button>
        <button
          type="button"
          className={`${tool} min-w-20 tabular-nums`}
          aria-label={LAYOUT_COPY.canvasZoomFit(percent)}
          data-testid="canvas-zoom"
          onClick={() => applyZoom(CANVAS_ZOOM.min)}
        >
          {percent}%
        </button>
        <button type="button" className={tool} aria-label={LAYOUT_COPY.canvasZoomIn} disabled={zoom >= CANVAS_ZOOM.max} onClick={() => applyZoom(stepCanvasZoom(zoom, 'in'))}>
          +
        </button>
      </div>
      <div
        ref={viewportRef}
        data-testid="layout-viewport"
        data-zoom={zoom}
        className={`relative min-h-0 flex-1 overflow-auto rounded-[var(--radius-field)] border border-line bg-bg ${zoom > CANVAS_ZOOM.min ? 'cursor-grab' : ''}`}
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
