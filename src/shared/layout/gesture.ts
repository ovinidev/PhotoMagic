import { slotBounds, slotCenter } from './geometry'
import { CUT_LINE_Y, type Slot } from './types'

/**
 * Editor gestures as pure numbers (DESIGN §7): move, resize from one of the 8 handles, rotate from
 * the rotation handle. Every input is in sheet pixels; the editor converts pointer pixels first.
 * The result is the raw draft; snapping (`snap.ts`) and rounding come after.
 */

/** Minimum slot size, so a handle never inverts the rectangle (DESIGN §7). */
export const MIN_SLOT_SIZE = 40

export const RESIZE_HANDLES = ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w'] as const
export type ResizeHandle = (typeof RESIZE_HANDLES)[number]

/** Which local edges a handle drags: -1 the left/top edge, 1 the right/bottom edge, 0 neither. */
export const HANDLE_SIGNS: Record<ResizeHandle, { x: -1 | 0 | 1; y: -1 | 0 | 1 }> = {
  nw: { x: -1, y: -1 },
  n: { x: 0, y: -1 },
  ne: { x: 1, y: -1 },
  e: { x: 1, y: 0 },
  se: { x: 1, y: 1 },
  s: { x: 0, y: 1 },
  sw: { x: -1, y: 1 },
  w: { x: -1, y: 0 },
}

type Point = { x: number; y: number }

const toRadians = (degrees: number) => (degrees * Math.PI) / 180

/** Rotates a local vector clockwise by `degrees` (sheet y grows downwards, like CSS `rotate`). */
export function rotateVector(vector: Point, degrees: number): Point {
  const radians = toRadians(degrees)
  const cos = Math.cos(radians)
  const sin = Math.sin(radians)
  return { x: vector.x * cos - vector.y * sin, y: vector.x * sin + vector.y * cos }
}

/** The slot moved by a pointer delta. */
export function moveSlot(origin: Slot, delta: Point): Slot {
  return { ...origin, left: origin.left + delta.x, top: origin.top + delta.y }
}

/**
 * The slot resized from `handle` by a pointer delta. The delta is read in the slot's own (rotated)
 * axes, so the handle follows the pointer at any angle, and the opposite edge or corner stays put.
 * Width and Height never go below `MIN_SLOT_SIZE`.
 */
export function resizeSlot(origin: Slot, handle: ResizeHandle, delta: Point): Slot {
  const sign = HANDLE_SIGNS[handle]
  const local = rotateVector(delta, -origin.angle)
  const width = sign.x === 0 ? origin.width : Math.max(MIN_SLOT_SIZE, origin.width + sign.x * local.x)
  const height = sign.y === 0 ? origin.height : Math.max(MIN_SLOT_SIZE, origin.height + sign.y * local.y)

  const center = slotCenter(origin)
  const anchorOffset = rotateVector({ x: (-sign.x * origin.width) / 2, y: (-sign.y * origin.height) / 2 }, origin.angle)
  const anchor = { x: center.x + anchorOffset.x, y: center.y + anchorOffset.y }
  const toCenter = rotateVector({ x: (sign.x * width) / 2, y: (sign.y * height) / 2 }, origin.angle)
  const next = { x: anchor.x + toCenter.x, y: anchor.y + toCenter.y }
  return { ...origin, width, height, left: next.x - width / 2, top: next.y - height / 2 }
}

/**
 * The angle that points the rotation handle at `pointer`. The handle sits below the bottom center
 * of the unrotated slot, so at Angle 0 it points straight down. Returns degrees in [0, 360).
 */
export function angleTowards(slot: Slot, pointer: Point): number {
  const center = slotCenter(slot)
  const degrees = (Math.atan2(pointer.y - center.y, pointer.x - center.x) * 180) / Math.PI - 90
  return ((degrees % 360) + 360) % 360
}

/** The panel shows integers (DESIGN §6, editor model); the draft is stored the same way. Angle 360 folds to 0. */
export function roundSlot(slot: Slot): Slot {
  return {
    ...slot,
    left: Math.round(slot.left),
    top: Math.round(slot.top),
    width: Math.max(MIN_SLOT_SIZE, Math.round(slot.width)),
    height: Math.max(MIN_SLOT_SIZE, Math.round(slot.height)),
    angle: Math.round(((slot.angle % 360) + 360) % 360) % 360,
  }
}

/** Whether the slot, as the sheet shows it, crosses the working cut line (2 tiras only; PRD §11.2). */
export function crossesCutLine(slot: Slot, cutY: number = CUT_LINE_Y): boolean {
  const bounds = slotBounds(slot)
  return bounds.top < cutY && bounds.top + bounds.height > cutY
}
