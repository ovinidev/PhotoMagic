import { COPIES } from './constants'

/**
 * Pure rules of the round that both windows and main share (PRD §6.4, §6.5). No React, no Electron.
 */

/** Shutter timer in seconds: off, 5 s or 10 s (RF07). */
export const TIMER_OPTIONS = [0, 5, 10] as const
export type TimerSeconds = (typeof TIMER_OPTIONS)[number]

/** `Mais` (+1) and `Menos` (-1): copies stay within 1..10 (PRD §4.9, RF10). */
export function stepCopies(current: number, delta: 1 | -1): number {
  return clampCopies(current + delta)
}

export function clampCopies(value: number): number {
  if (!Number.isFinite(value)) return COPIES.min
  return Math.min(COPIES.max, Math.max(COPIES.min, Math.round(value)))
}
