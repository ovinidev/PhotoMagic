/** Frosted glass over the image (DESIGN §14), with an opaque fallback when there is no blur. */
export const GLASS =
  'bg-glass-strong backdrop-blur-[24px] supports-[not(backdrop-filter:blur(1px))]:bg-[rgba(28,28,30,0.72)]'

/**
 * The TV camera bars (DESIGN §14): dark translucent black over the live image, as on the iPhone
 * camera, with a blur and a darker fallback when the compositor has no `backdrop-filter`.
 */
export const BAR = 'bg-black/45 backdrop-blur-[24px] supports-[not(backdrop-filter:blur(1px))]:bg-black/70'
