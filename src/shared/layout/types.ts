/**
 * Print modes and slot layouts (PRD §4.3, §6.2; DESIGN §6). No React and no Electron.
 */

/** `two-strips` (2 tiras, default): five slots and the 2" cut. `one-strip` (1 tira): three slots, no cut. */
export const PRINT_MODES = ['two-strips', 'one-strip'] as const
export type PrintMode = (typeof PRINT_MODES)[number]

export const DEFAULT_PRINT_MODE: PrintMode = 'two-strips'

/** A round always has three photos, in both modes (PRD §6.4, RF06). */
export const PHOTOS_PER_ROUND = 3
export const PHOTO_INDEXES = [1, 2, 3] as const
export type PhotoIndex = (typeof PHOTO_INDEXES)[number]

/**
 * One rectangle on the 1844×1240 sheet (DESIGN §6, editor model). `left` and `top` are the corner of
 * the rectangle before rotation; `width` and `height` never swap with the angle; the rotation is
 * clockwise, in degrees, around the rectangle's center.
 */
export type Slot = {
  /** Stable id; the editor shows its pt-BR label (Cima 1, Baixo 1, …). */
  id: string
  photo: PhotoIndex
  left: number
  top: number
  width: number
  height: number
  angle: number
}

export type Layouts = Record<PrintMode, readonly Slot[]>

/**
 * Working cut line of the 2-strip layout, in sheet pixels. Pending from the client (PRD §11.2):
 * it only feeds the editor guide and warning; the printer's blade position comes from the driver.
 */
export const CUT_LINE_Y = 620

/** The 2" cut is on in 2 tiras and off in 1 tira (PRD §4.3, RF11). */
export function cutFor(mode: PrintMode): boolean {
  return mode === 'two-strips'
}
