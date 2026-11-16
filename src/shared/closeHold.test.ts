import { describe, expect, it } from 'vitest'
import { CLOSE_HOLD, IDLE, holdProgress, nextHold, type HoldInput, type HoldState } from './closeHold'

const A = { x: 100, y: 500 }
const B = { x: 300, y: 520 }

function run(inputs: HoldInput[], from: HoldState = IDLE) {
  let state = from
  let fired = 0
  for (const input of inputs) {
    const result = nextHold(state, input)
    state = result.state
    if (result.fire) fired += 1
  }
  return { state, fired }
}

describe('two-finger close hold', () => {
  it('fires once after two still fingers are held for the full time', () => {
    const { fired, state } = run([
      { type: 'touches', at: 0, points: [A, B] },
      { type: 'tick', at: 1000 },
      { type: 'tick', at: CLOSE_HOLD.ms },
      { type: 'tick', at: CLOSE_HOLD.ms + 500 },
    ])
    expect(fired).toBe(1)
    expect(state.kind).toBe('spent')
  })

  it('never fires with one finger, however long', () => {
    expect(run([{ type: 'touches', at: 0, points: [A] }, { type: 'tick', at: 10_000 }]).fired).toBe(0)
  })

  it('never fires on a quick two-finger tap', () => {
    expect(run([{ type: 'touches', at: 0, points: [A, B] }, { type: 'touches', at: 150, points: [] }, { type: 'tick', at: 5000 }]).fired).toBe(0)
  })

  it('cancels when a finger lifts, a third lands, or the fingers move', () => {
    const start: HoldInput = { type: 'touches', at: 0, points: [A, B] }
    const late: HoldInput = { type: 'tick', at: CLOSE_HOLD.ms + 1 }
    expect(run([start, { type: 'touches', at: 500, points: [A] }, late]).fired).toBe(0)
    expect(run([start, { type: 'touches', at: 500, points: [A, B, { x: 0, y: 0 }] }, late]).fired).toBe(0)
    expect(run([start, { type: 'touches', at: 500, points: [A, { x: B.x + CLOSE_HOLD.slop + 1, y: B.y }] }, late]).fired).toBe(0)
  })

  it('tolerates a small drift', () => {
    expect(run([{ type: 'touches', at: 0, points: [A, B] }, { type: 'touches', at: 400, points: [{ x: A.x + 10, y: A.y - 10 }, B] }, { type: 'tick', at: CLOSE_HOLD.ms }]).fired).toBe(1)
  })

  it('needs every finger lifted before a new hold, so one long press cannot fire twice', () => {
    const fired = run([
      { type: 'touches', at: 0, points: [A, B] },
      { type: 'tick', at: CLOSE_HOLD.ms },
      // One finger lifts and lands again while the other stays down.
      { type: 'touches', at: CLOSE_HOLD.ms + 100, points: [A] },
      { type: 'touches', at: CLOSE_HOLD.ms + 200, points: [A, B] },
      { type: 'tick', at: 3 * CLOSE_HOLD.ms },
    ])
    expect(fired.fired).toBe(1)
    const again = run([{ type: 'touches', at: 9000, points: [] }, { type: 'touches', at: 9100, points: [A, B] }, { type: 'tick', at: 9100 + CLOSE_HOLD.ms }], fired.state)
    expect(again.fired).toBe(1)
  })

  it('shows the hint only after the quick-tap window, growing to 1', () => {
    const holding = nextHold(IDLE, { type: 'touches', at: 0, points: [A, B] }).state
    expect(holdProgress(IDLE, 1000)).toBeNull()
    expect(holdProgress(holding, CLOSE_HOLD.hintAfterMs - 1)).toBeNull()
    expect(holdProgress(holding, CLOSE_HOLD.ms / 2)).toBeCloseTo(0.5)
    expect(holdProgress(holding, CLOSE_HOLD.ms * 2)).toBe(1)
  })
})
