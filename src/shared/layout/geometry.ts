import { coverFit, normalizeRotation, type QuarterTurn, type Size } from '../capture'
import { SHEET } from '../constants'
import type { PhotoIndex, Slot } from './types'

/**
 * Slot geometry of the montage (DESIGN §6). Pure numbers: `src/main/compose/` runs them with sharp,
 * and the laptop guide uses the same crop, so the preview, the guide and the file agree.
 */

export type Rect = { left: number; top: number; width: number; height: number }

/**
 * How the operator framed the photo inside one slot of the round (DESIGN §8). `zoom` 1 to 3;
 * `panX`/`panY` from -1 (left/top edge of the photo) to 1 (right/bottom edge), 0 is the center;
 * `rotation` turns the photo clockwise inside the still slot, in degrees, -180 to 180.
 */
export type Framing = { zoom: number; panX: number; panY: number; rotation: number }

export const DEFAULT_FRAMING: Framing = { zoom: 1, panX: 0, panY: 0, rotation: 0 }
export const ZOOM_RANGE = { min: 1, max: 3 } as const
export const FRAMING_ROTATION_RANGE = { min: -180, max: 180 } as const

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value))

/**
 * Keeps the zoom in 1..3, the pan in -1..1 and the rotation in -180..180 (folded, so 190 becomes
 * -170), so the photo always covers the slot (RF09).
 */
export function clampFraming(framing: Framing): Framing {
  const rotation = Number.isFinite(framing.rotation) ? framing.rotation : 0
  const folded = normalizeAngle(rotation)
  return {
    zoom: clamp(Number.isFinite(framing.zoom) ? framing.zoom : 1, ZOOM_RANGE.min, ZOOM_RANGE.max),
    panX: clamp(Number.isFinite(framing.panX) ? framing.panX : 0, -1, 1),
    panY: clamp(Number.isFinite(framing.panY) ? framing.panY : 0, -1, 1),
    rotation: folded > 180 ? folded - 360 : folded,
  }
}

/** True when the framing is the default one (zoom 1, centered, not rotated). */
export function isDefaultFraming(framing: Framing): boolean {
  return framing.zoom === 1 && framing.panX === 0 && framing.panY === 0 && framing.rotation === 0
}

/** Any angle folded into [0, 360). */
export function normalizeAngle(degrees: number): number {
  const folded = ((degrees % 360) + 360) % 360
  return folded === 360 ? 0 : folded
}

/** The quarter turn closest to `degrees` (ties go to the smaller turn). */
export function nearestQuarterTurn(degrees: number): QuarterTurn {
  return normalizeRotation((Math.round(normalizeAngle(degrees) / 90) * 90) % 360)
}

export function slotCenter(slot: Slot): { x: number; y: number } {
  return { x: slot.left + slot.width / 2, y: slot.top + slot.height / 2 }
}

/** Axis-aligned bounds of the slot after its rotation around the center: what the sheet shows. */
export function slotBounds(slot: Slot): Rect {
  const radians = (normalizeAngle(slot.angle) * Math.PI) / 180
  const cos = Math.abs(round6(Math.cos(radians)))
  const sin = Math.abs(round6(Math.sin(radians)))
  const width = slot.width * cos + slot.height * sin
  const height = slot.width * sin + slot.height * cos
  const center = slotCenter(slot)
  return { left: center.x - width / 2, top: center.y - height / 2, width, height }
}

/**
 * The steps that put one photo into one slot, in order:
 * 1. rotate the upright photo clockwise by `preRotate`, so that step 4 stands it up again: the
 *    slot's angle turns the frame (Angle 270 makes a 500×281 slot tall) but the person stays upright;
 * 2. resize to `resize`, which covers the unrotated `width × height` box at the framing's zoom (with a
 *    framing rotation, it covers the bounds of the box turned by that rotation, so no corner shows);
 * 3. extract `extract` (that box, moved by the framing's pan; pan 0 crops the center in equal parts);
 * 4. with a framing rotation, rotate the tile clockwise by `rotate` and keep the centered `box`;
 * 5. rotate that tile clockwise by `angle` around its center and place the center at `center`.
 */
export type SlotPlan = {
  preRotate: QuarterTurn
  resize: Size
  extract: Rect
  /** The framing rotation, degrees clockwise; 0 skips step 4. */
  rotate: number
  /** The slot's unrotated box, the tile size after step 4. */
  box: Size
  angle: number
  center: { x: number; y: number }
}

export function planSlot(slot: Slot, photo: Size, framing: Framing = DEFAULT_FRAMING): SlotPlan {
  const { zoom, panX, panY, rotation } = clampFraming(framing)
  const turn = nearestQuarterTurn(slot.angle)
  const preRotate = normalizeRotation((360 - turn) % 360)
  const turned = preRotate === 90 || preRotate === 270 ? { width: photo.height, height: photo.width } : photo
  const box = { width: Math.round(slot.width), height: Math.round(slot.height) }
  const need = rotation === 0 ? box : rotatedCover(box, rotation)

  const scale = coverFit(turned, need).scale * zoom
  // Never below the box: rounding must not leave a 1 px strip uncovered.
  const resize = {
    width: Math.max(need.width, Math.round(turned.width * scale)),
    height: Math.max(need.height, Math.round(turned.height * scale)),
  }
  const spareX = resize.width - need.width
  const spareY = resize.height - need.height
  const extract = {
    left: Math.round((spareX / 2) * (1 + panX)),
    top: Math.round((spareY / 2) * (1 + panY)),
    width: need.width,
    height: need.height,
  }
  return { preRotate, resize, extract, rotate: rotation, box, angle: normalizeAngle(slot.angle), center: slotCenter(slot) }
}

/**
 * The tile that, turned by `rotation`, still covers `box` everywhere: the bounds of the box turned
 * the other way, plus 2 px so rounding never shows a transparent corner.
 */
function rotatedCover(box: Size, rotation: number): Size {
  const radians = (rotation * Math.PI) / 180
  const cos = Math.abs(round6(Math.cos(radians)))
  const sin = Math.abs(round6(Math.sin(radians)))
  return {
    width: Math.ceil(box.width * cos + box.height * sin) + 2,
    height: Math.ceil(box.width * sin + box.height * cos) + 2,
  }
}

/**
 * Where an image of `size` centered at `center` lands on the sheet, clipped to it: the part of the
 * image to keep (`source`) and its integer position (`target`). `null` when it misses the sheet.
 * Seed slots can stick out of the sheet (Cima 1 rotated by 270 starts above y = 0), so clipping is
 * part of the plan, not an error.
 */
export function clipToSheet(
  center: { x: number; y: number },
  size: Size,
  sheet: Size = SHEET,
): { source: Rect; target: { left: number; top: number } } | null {
  const left = Math.round(center.x - size.width / 2)
  const top = Math.round(center.y - size.height / 2)
  const x0 = Math.max(0, left)
  const y0 = Math.max(0, top)
  const x1 = Math.min(sheet.width, left + size.width)
  const y1 = Math.min(sheet.height, top + size.height)
  if (x1 <= x0 || y1 <= y0) return null
  return {
    source: { left: x0 - left, top: y0 - top, width: x1 - x0, height: y1 - y0 },
    target: { left: x0, top: y0 },
  }
}

/**
 * Part of the upright photo a slot keeps at the default framing, as fractions of the photo (0 to 1).
 * The slot's visible shape is its rotated box, filled by the upright photo with `cover`.
 */
export function slotCrop(slot: Slot, photo: Size): Rect {
  const turn = nearestQuarterTurn(slot.angle)
  const visible = turn === 90 || turn === 270 ? { width: slot.height, height: slot.width } : { width: slot.width, height: slot.height }
  const fit = coverFit(photo, visible)
  const width = Math.min(1, visible.width / (photo.width * fit.scale))
  const height = Math.min(1, visible.height / (photo.height * fit.scale))
  return { left: (1 - width) / 2, top: (1 - height) / 2, width, height }
}

/**
 * The live-camera guide on the laptop (DESIGN §8): the part of the frame that every slot of the next
 * photo keeps, as fractions of the frame. In 2 tiras, photos 1 and 2 show the bottom strip's
 * horizontal band; in 1 tira, the portrait slot. `null` when no slot uses that photo.
 */
export function guideCrop(slots: readonly Slot[], photo: PhotoIndex, frame: Size): Rect | null {
  const crops = slots.filter((slot) => slot.photo === photo).map((slot) => slotCrop(slot, frame))
  if (crops.length === 0) return null
  const width = Math.min(...crops.map((crop) => crop.width))
  const height = Math.min(...crops.map((crop) => crop.height))
  return { left: (1 - width) / 2, top: (1 - height) / 2, width, height }
}

/** Rounds away the 1e-17 noise of `Math.cos(Math.PI / 2)` and friends. */
function round6(value: number): number {
  return Math.round(value * 1e6) / 1e6
}
