/**
 * Slide rules of the TV attract screen (DESIGN §14, Attract screen). Pure: no React, no IPC.
 */

/** At most this many recent montages cycle on the attract screen, so memory stays bounded. */
export const ATTRACT_PHOTO_LIMIT = 12

/** How long each montage stays before the next one crossfades in. */
export const ATTRACT_SLIDE_MS = 6_000

/** Length of the crossfade between two montages, kept in sync with `attract-fade-in` in `index.css`. */
export const ATTRACT_FADE_MS = 1_200

/** A fresh round left untouched this long on the TV shows the attract screen. */
export const ATTRACT_IDLE_MS = 45_000

/** The newest `limit` names of a newest-first gallery list. */
export function recentSlides(fileNames: readonly string[], limit = ATTRACT_PHOTO_LIMIT): string[] {
  return fileNames.slice(0, Math.max(0, limit))
}

/** The slide after `index`, wrapping around; 0 when there is nothing to cycle. */
export function nextSlide(index: number, count: number): number {
  return count > 0 ? (index + 1) % count : 0
}
