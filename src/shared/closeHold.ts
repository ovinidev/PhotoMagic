/**
 * Two-finger press-and-hold that closes the TV window (DESIGN §3). Pure, so the rule is tested
 * without touch hardware: exactly two fingers, held still for `CLOSE_HOLD.ms`, fire once. One
 * finger, a third finger, a quick tap or fingers that move (a swipe, a pinch) never fire. After
 * firing or cancelling, every finger must lift before a new hold can start.
 */
export const CLOSE_HOLD = {
  /** How long the two fingers stay down. */
  ms: 2000,
  /** The hint appears only after this, so a quick two-finger tap shows nothing. */
  hintAfterMs: 300,
  /** Logical px either finger may drift from where it landed. */
  slop: 40,
} as const

export type Point = { x: number; y: number }

export type HoldState =
  | { kind: 'idle' }
  | { kind: 'holding'; since: number; origin: Point[] }
  /** Fired or cancelled: waits for every finger to lift. */
  | { kind: 'spent' }

export type HoldInput =
  /** The fingers currently on the screen, after any touchstart/move/end/cancel. */
  | { type: 'touches'; at: number; points: Point[] }
  | { type: 'tick'; at: number }

export type HoldResult = { state: HoldState; fire: boolean }

export const IDLE: HoldState = { kind: 'idle' }

const drifted = (origin: Point[], points: Point[]) =>
  points.some((point, index) => {
    const start = origin[index]
    return !start || Math.hypot(point.x - start.x, point.y - start.y) > CLOSE_HOLD.slop
  })

export function nextHold(state: HoldState, input: HoldInput): HoldResult {
  if (input.type === 'touches') {
    const count = input.points.length
    if (count === 0) return { state: IDLE, fire: false }
    if (state.kind === 'spent') return { state, fire: false }
    if (state.kind === 'idle') {
      return { state: count === 2 ? { kind: 'holding', since: input.at, origin: input.points } : state, fire: false }
    }
    // Holding: a finger lifted or added, or the fingers moved, cancels for good.
    if (count !== 2 || drifted(state.origin, input.points)) return { state: { kind: 'spent' }, fire: false }
    return { state, fire: false }
  }
  if (state.kind === 'holding' && input.at - state.since >= CLOSE_HOLD.ms) return { state: { kind: 'spent' }, fire: true }
  return { state, fire: false }
}

/** 0..1 for the hint, or `null` when the hint is hidden (no hold, or still inside the quick-tap window). */
export function holdProgress(state: HoldState, now: number): number | null {
  if (state.kind !== 'holding') return null
  const elapsed = now - state.since
  if (elapsed < CLOSE_HOLD.hintAfterMs) return null
  return Math.min(1, elapsed / CLOSE_HOLD.ms)
}
