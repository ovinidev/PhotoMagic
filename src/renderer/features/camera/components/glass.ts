/** Frosted glass over the image (DESIGN §14), with an opaque fallback when there is no blur. */
export const GLASS =
  'bg-glass-strong backdrop-blur-[24px] supports-[not(backdrop-filter:blur(1px))]:bg-[rgba(28,28,30,0.72)]'
