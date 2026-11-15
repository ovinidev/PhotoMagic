import type { Size } from '../capture'
import { clampFraming, planSlot, slotCenter, type Framing } from './geometry'
import { rotateVector } from './gesture'
import type { Slot } from './types'

/**
 * Round framing gestures as pure numbers (RF09, DESIGN §8). The slot stays still; only the photo
 * inside it moves, zooms and turns. Pointer deltas come in sheet pixels.
 */

type Point = { x: number; y: number }

/**
 * The capture the gestures assume: the 1920×1080 request stood upright. It only sets how far a drag
 * pans; the montage itself uses the real capture size.
 */
export const ASSUMED_PHOTO: Size = { width: 1080, height: 1920 }

/** Rotation snaps to 0° within this many degrees, so a straight photo is easy to get back. */
export const FRAMING_ROTATION_SNAP = 3

/**
 * The framing after dragging the photo by `delta` on the sheet. The photo follows the pointer: the
 * delta is read in the photo's own axes (slot angle plus framing rotation) and turned into pan, so a
 * drag to the right moves the photo to the right at any angle. Pan stays in -1..1, so the slot stays
 * covered; an axis with no spare photo does not move.
 */
export function panFraming(origin: Framing, slot: Slot, delta: Point, photo: Size = ASSUMED_PHOTO): Framing {
  const plan = planSlot(slot, photo, origin)
  const local = rotateVector(delta, -(slot.angle + origin.rotation))
  const spareX = (plan.resize.width - plan.extract.width) / 2
  const spareY = (plan.resize.height - plan.extract.height) / 2
  return clampFraming({
    ...origin,
    panX: spareX > 0 ? origin.panX - local.x / spareX : origin.panX,
    panY: spareY > 0 ? origin.panY - local.y / spareY : origin.panY,
  })
}

/** The framing zoomed by `factor` (wheel or buttons), kept in 1..3. */
export function zoomFraming(origin: Framing, factor: number): Framing {
  return clampFraming({ ...origin, zoom: origin.zoom * factor })
}

/** Zoom factor of one wheel event: scrolling up (negative `deltaY`) zooms in. */
export function wheelZoomFactor(deltaY: number): number {
  return Math.exp(-deltaY / 500)
}

/**
 * The framing turned by the rotation handle: the angle the pointer swept around the slot center
 * since `start`. Snaps to 0° within 3°, unless `alt` is held.
 */
export function rotateFraming(origin: Framing, slot: Slot, start: Point, pointer: Point, { alt = false }: { alt?: boolean } = {}): Framing {
  const center = slotCenter(slot)
  const from = Math.atan2(start.y - center.y, start.x - center.x)
  const to = Math.atan2(pointer.y - center.y, pointer.x - center.x)
  return turnFraming(origin, ((to - from) * 180) / Math.PI, { alt })
}

/** The framing turned by `degrees` clockwise, folded into -180..180 and snapped to 0° within 3°. */
export function turnFraming(origin: Framing, degrees: number, { alt = false }: { alt?: boolean } = {}): Framing {
  const next = clampFraming({ ...origin, rotation: origin.rotation + degrees })
  const rotation = !alt && Math.abs(next.rotation) <= FRAMING_ROTATION_SNAP ? 0 : Math.round(next.rotation * 10) / 10
  return { ...next, rotation }
}
