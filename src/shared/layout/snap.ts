import { PRINT_MARGIN, SHEET } from '../constants'
import { nearestQuarterTurn, normalizeAngle, slotBounds, type Rect } from './geometry'
import { HANDLE_SIGNS, rotateVector, type ResizeHandle } from './gesture'
import { CUT_LINE_Y, type PrintMode, type Slot } from './types'

/**
 * Editor snap (PRD §4.11, RF03; DESIGN §7). Pure: `snapMove`, `snapResize` and `snapAngle` take the
 * draft of the gesture and return the draft to show. Alt held returns the draft unchanged.
 *
 * Targets, on the slot as the sheet shows it (its rotated bounds):
 * - edges of the slot snap to the sheet edges, the print margins, the edges of the other slots and,
 *   only in the 2-strip layout, the cut line;
 * - the center of the slot snaps to the sheet center and to the centers of the other slots.
 * In 1 tira the cut line is not a target: a slot edge at y = 620 stays where the pointer left it,
 * even though the sheet center (a center target) is also at y = 620.
 */

/** Distance, in sheet pixels (not screen pixels), within which a slot snaps (DESIGN §7). */
export const SNAP_TOLERANCE = 8
/** Degrees within which the angle snaps to 0, 90, 180 or 270. */
export const ANGLE_SNAP_TOLERANCE = 4

export type SnapOptions = { mode: PrintMode; alt: boolean }

export type SnapTargets = {
  edgesX: number[]
  edgesY: number[]
  centersX: number[]
  centersY: number[]
}

/** Every line a slot can snap to, for one layout and the other slots of it. */
export function snapTargets(mode: PrintMode, others: readonly Slot[]): SnapTargets {
  const edgesX = [0, SHEET.width, PRINT_MARGIN.x, SHEET.width - PRINT_MARGIN.x]
  const edgesY = [0, SHEET.height, PRINT_MARGIN.y, SHEET.height - PRINT_MARGIN.y]
  if (mode === 'two-strips') edgesY.push(CUT_LINE_Y)
  const centersX = [SHEET.width / 2]
  const centersY = [SHEET.height / 2]
  for (const other of others) {
    const b = slotBounds(other)
    edgesX.push(b.left, b.left + b.width)
    edgesY.push(b.top, b.top + b.height)
    centersX.push(b.left + b.width / 2)
    centersY.push(b.top + b.height / 2)
  }
  return { edgesX, edgesY, centersX, centersY }
}

/** The smallest shift (target − value) within the tolerance, or 0. */
function bestShift(pairs: Array<{ values: number[]; targets: number[] }>): number {
  let best: number | null = null
  for (const { values, targets } of pairs) {
    for (const value of values) {
      for (const target of targets) {
        const shift = target - value
        if (Math.abs(shift) <= SNAP_TOLERANCE && (best === null || Math.abs(shift) < Math.abs(best))) best = shift
      }
    }
  }
  return best ?? 0
}

/** Moves the dragged slot so its nearest edge or center lands on a target, per axis. */
export function snapMove(draft: Slot, others: readonly Slot[], options: SnapOptions): Slot {
  if (options.alt) return draft
  const t = snapTargets(options.mode, others)
  const b = slotBounds(draft)
  const dx = bestShift([
    { values: [b.left, b.left + b.width], targets: t.edgesX },
    { values: [b.left + b.width / 2], targets: t.centersX },
  ])
  const dy = bestShift([
    { values: [b.top, b.top + b.height], targets: t.edgesY },
    { values: [b.top + b.height / 2], targets: t.centersY },
  ])
  return { ...draft, left: draft.left + dx, top: draft.top + dy }
}

/**
 * Snaps the edges a resize handle drags. Only for a slot at a quarter turn (0, 90, 180, 270), where
 * the dragged local edge is a vertical or horizontal line on the sheet; a tilted slot resizes freely.
 */
export function snapResize(draft: Slot, handle: ResizeHandle, others: readonly Slot[], options: SnapOptions): Slot {
  if (options.alt) return draft
  const angle = normalizeAngle(draft.angle)
  const turn = nearestQuarterTurn(angle)
  if (Math.abs(angle - turn) > 1e-9 && Math.abs(angle - 360) > 1e-9) return draft

  const t = snapTargets(options.mode, others)
  const world = rotateVector(HANDLE_SIGNS[handle], turn)
  const wx = Math.round(world.x)
  const wy = Math.round(world.y)
  const b = slotBounds(draft)
  let { left, top } = b
  let right = b.left + b.width
  let bottom = b.top + b.height
  if (wx === 1) right += bestShift([{ values: [right], targets: t.edgesX }])
  if (wx === -1) left += bestShift([{ values: [left], targets: t.edgesX }])
  if (wy === 1) bottom += bestShift([{ values: [bottom], targets: t.edgesY }])
  if (wy === -1) top += bestShift([{ values: [top], targets: t.edgesY }])
  return fromBounds(draft, { left, top, width: right - left, height: bottom - top }, turn)
}

/** The slot whose rotated bounds are `bounds`, at a quarter turn. */
function fromBounds(draft: Slot, bounds: Rect, turn: number): Slot {
  const sideways = turn === 90 || turn === 270
  const width = sideways ? bounds.height : bounds.width
  const height = sideways ? bounds.width : bounds.height
  const cx = bounds.left + bounds.width / 2
  const cy = bounds.top + bounds.height / 2
  return { ...draft, width, height, left: cx - width / 2, top: cy - height / 2 }
}

/** Snaps the angle to 0, 90, 180 or 270 within 4°. Returns degrees in [0, 360). */
export function snapAngle(angle: number, options: Pick<SnapOptions, 'alt'>): number {
  const folded = normalizeAngle(angle)
  if (options.alt) return folded
  const quarter = Math.round(folded / 90) * 90
  return Math.abs(folded - quarter) <= ANGLE_SNAP_TOLERANCE ? quarter % 360 : folded
}
