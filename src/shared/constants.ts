/**
 * Fixed product numbers. No React and no Electron: main, preload and renderer import from here.
 * See docs/DESIGN.md §5 (capture) and §6 (montage).
 */

/**
 * The MX Brio is mounted horizontally. Software rotates the frame to portrait by this angle,
 * then mirrors it horizontally. Preview and saved file use the same value.
 * Flip the sign if the first hardware test shows the person upside down.
 */
export const CAMERA_ROTATION_DEG = 90

/** Print extent of the DS-RX1 6×4" sheet, in pixels. Templates and montages are exactly this size. */
export const SHEET = {
  width: 1844,
  height: 1240,
  dpi: 300,
} as const

/** Non-printable margin of the DS-RX1, in sheet pixels. */
export const PRINT_MARGIN = {
  x: 22,
  y: 20,
} as const

/** Inner printable area: 1844 − 2·22 by 1240 − 2·20. */
export const PRINTABLE_AREA = {
  width: SHEET.width - 2 * PRINT_MARGIN.x,
  height: SHEET.height - 2 * PRINT_MARGIN.y,
} as const

/** Copies per print: `Menos` stops at the minimum, `Mais` at the maximum. */
export const COPIES = {
  min: 1,
  max: 10,
} as const

/** Logical frame of the TV window, in portrait. */
export const TV_FRAME = {
  width: 1080,
  height: 1920,
} as const
