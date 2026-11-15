import { describe, expect, it } from 'vitest'
import { TWO_STRIPS_SEED } from '@shared/layout'
import { HISTORY_LIMIT, canRedo, canUndo, commit, redo, replaceSlot, startHistory, undo } from './history'

const moved = (left: number) => replaceSlot(TWO_STRIPS_SEED, { ...TWO_STRIPS_SEED[0]!, left })

describe('editor history', () => {
  it('undoes and redoes committed steps in order', () => {
    let h = startHistory(TWO_STRIPS_SEED)
    h = commit(h, moved(80))
    h = commit(h, moved(90))
    expect(h.present[0]!.left).toBe(90)
    h = undo(h)
    expect(h.present[0]!.left).toBe(80)
    h = undo(h)
    expect(h.present).toBe(TWO_STRIPS_SEED)
    expect(canUndo(h)).toBe(false)
    h = redo(h)
    expect(h.present[0]!.left).toBe(80)
    expect(canRedo(h)).toBe(true)
  })

  it('drops the redo branch on a new step', () => {
    let h = commit(startHistory(TWO_STRIPS_SEED), moved(80))
    h = commit(undo(h), moved(100))
    expect(canRedo(h)).toBe(false)
    expect(h.present[0]!.left).toBe(100)
  })

  it('does not record a step with the same numbers', () => {
    const h = startHistory(TWO_STRIPS_SEED)
    expect(commit(h, TWO_STRIPS_SEED.map((slot) => ({ ...slot })))).toBe(h)
  })

  it('keeps at most the history limit', () => {
    let h = startHistory(TWO_STRIPS_SEED)
    for (let i = 1; i <= HISTORY_LIMIT + 10; i++) h = commit(h, moved(i))
    expect(h.past).toHaveLength(HISTORY_LIMIT)
  })
})
