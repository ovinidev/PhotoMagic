import { describe, expect, it, vi } from 'vitest'
import type { SessionState } from '@shared/ipc'
import { TWO_STRIPS_SEED } from '@shared/layout'
import type { Printer, PrintResult } from '../print'
import { createSession, type OpenEvent } from './session'

const EVENT: OpenEvent = { name: 'Aniversário AJ', mode: 'two-strips', folder: '/Desktop/Aniversário AJ', slots: TWO_STRIPS_SEED, template: null, boxes: null }
const jpeg = (value: number) => new Uint8Array([value])

function setup(results: PrintResult[] = [{ ok: true }]) {
  const states: SessionState[] = []
  const print = vi.fn<Printer['print']>(async () => results.shift() ?? { ok: true })
  const saveMontage = vi.fn(async () => ({ fileName: '21-45-08.jpg', path: '/Desktop/Aniversário AJ/21-45-08.jpg' }))
  const render = vi.fn(async (_input: unknown, output: { kind: string }) => new Uint8Array([output.kind === 'montage' ? 9 : 7]))
  const session = createSession({ render, saveMontage, printer: { status: async () => ({ kind: 'ready' }), print }, onChange: (state) => states.push(state) })
  return { session, states, print, saveMontage, render }
}

const phase = (state: SessionState) => (state.kind === 'event' ? state.phase : null)
const taken = (state: SessionState) => (state.kind === 'event' ? state.taken : null)

function capture3(session: ReturnType<typeof setup>['session']) {
  session.addPhoto(1, jpeg(1))
  session.addPhoto(2, jpeg(2))
  return session.addPhoto(3, jpeg(3))
}

describe('session', () => {
  it('is idle until an event starts, then captures at 0/3 with one copy', () => {
    const { session } = setup()
    expect(session.state()).toEqual({ kind: 'idle' })
    const state = session.start(EVENT)
    expect(state).toMatchObject({ kind: 'event', name: 'Aniversário AJ', mode: 'two-strips', taken: 0, copies: 1, timer: 0, phase: { kind: 'capturing' } })
  })

  it('takes three photos in order and moves to review; extra or out-of-order photos add nothing (RF06)', () => {
    const { session } = setup()
    session.start(EVENT)
    expect(taken(session.addPhoto(2, jpeg(2)))).toBe(0)
    expect(taken(session.addPhoto(1, jpeg(1)))).toBe(1)
    expect(taken(session.addPhoto(1, jpeg(1)))).toBe(1)
    session.addPhoto(2, jpeg(2))
    const state = session.addPhoto(3, jpeg(3))
    expect(taken(state)).toBe(3)
    expect(phase(state)).toEqual({ kind: 'review' })
    expect(taken(session.addPhoto(3, jpeg(4)))).toBe(3)
  })

  it('hands the laptop the round captures taken so far, for the local framing preview', () => {
    const { session } = setup()
    expect(session.photo(1)).toBeNull()
    session.start(EVENT)
    session.addPhoto(1, jpeg(1))
    expect(session.photo(1)).toEqual(jpeg(1))
    expect(session.photo(2)).toBeNull()
  })

  it('ignores photos with no event', () => {
    const { session } = setup()
    expect(session.addPhoto(1, jpeg(1))).toEqual({ kind: 'idle' })
  })

  it('bumps the preview revision after each composed preview', async () => {
    const { session, render } = setup()
    session.start(EVENT)
    await session.settled()
    const first = session.preview()
    expect(first.jpeg).toEqual(new Uint8Array([7]))
    session.addPhoto(1, jpeg(1))
    await session.settled()
    expect(session.preview().revision).toBe(first.revision + 1)
    expect(render).toHaveBeenLastCalledWith(expect.objectContaining({ photos: { 1: jpeg(1) } }), { kind: 'preview' })
  })

  it('clamps copies to 1..10 and keeps the timer', () => {
    const { session } = setup()
    session.start(EVENT)
    expect(session.setCopies(12)).toMatchObject({ copies: 10 })
    expect(session.setCopies(0)).toMatchObject({ copies: 1 })
    expect(session.setTimer(5)).toMatchObject({ timer: 5 })
  })

  it('Cancelar discards the round with no file and returns to 0/3 (RF10)', () => {
    const { session, saveMontage } = setup()
    session.start(EVENT)
    capture3(session)
    session.setCopies(3)
    const state = session.cancel()
    expect(state).toMatchObject({ taken: 0, copies: 1, phase: { kind: 'capturing' } })
    expect(saveMontage).not.toHaveBeenCalled()
  })

  it('Imprimir composes the montage, saves it once and sends the ticket (RF11, RF12)', async () => {
    const { session, saveMontage, print, render } = setup()
    session.start(EVENT)
    capture3(session)
    session.setCopies(2)
    const state = await session.print()
    expect(phase(state)).toEqual({ kind: 'printed', fileName: '21-45-08.jpg' })
    expect(render).toHaveBeenCalledWith(expect.objectContaining({ photos: { 1: jpeg(1), 2: jpeg(2), 3: jpeg(3) } }), { kind: 'montage' })
    expect(saveMontage).toHaveBeenCalledWith(EVENT.folder, new Uint8Array([9]))
    expect(print).toHaveBeenCalledWith({ jpegPath: '/Desktop/Aniversário AJ/21-45-08.jpg', copies: 2, mode: 'two-strips', cut: true })
  })

  it('announces the real print steps in order: saving, sending, then printed (DESIGN §14)', async () => {
    const { session, states } = setup()
    session.start(EVENT)
    capture3(session)
    const before = states.length
    await session.print()
    // A preview revision may notify mid-step with the same phase, so keep each change once.
    const phases = states
      .slice(before)
      .map(phase)
      .filter((next, index, all) => next?.kind !== 'review' && JSON.stringify(next) !== JSON.stringify(all[index - 1]))
    expect(phases).toEqual([
      { kind: 'printing', step: 'saving' },
      { kind: 'printing', step: 'sending' },
      { kind: 'printed', fileName: '21-45-08.jpg' },
    ])
    const again = states.length
    await session.reprint()
    expect(states.slice(again).map(phase)).toEqual([{ kind: 'printing', step: 'sending' }, { kind: 'printed', fileName: '21-45-08.jpg' }])
  })

  it('does not print before the third photo', async () => {
    const { session, print } = setup()
    session.start(EVENT)
    session.addPhoto(1, jpeg(1))
    expect(phase(await session.print())).toEqual({ kind: 'capturing' })
    expect(print).not.toHaveBeenCalled()
  })

  it('Imprimir novamente resends the same file with the current copies (RF13)', async () => {
    const { session, saveMontage, print } = setup()
    session.start(EVENT)
    capture3(session)
    await session.print()
    session.setCopies(4)
    expect(phase(await session.reprint())).toEqual({ kind: 'printed', fileName: '21-45-08.jpg' })
    expect(saveMontage).toHaveBeenCalledTimes(1)
    expect(print).toHaveBeenLastCalledWith(expect.objectContaining({ jpegPath: '/Desktop/Aniversário AJ/21-45-08.jpg', copies: 4 }))
  })

  it('Nova rodada returns to 0/3 only after a print (RF13)', async () => {
    const { session } = setup()
    session.start(EVENT)
    capture3(session)
    expect(phase(session.newRound())).toEqual({ kind: 'review' })
    await session.print()
    expect(session.newRound()).toMatchObject({ taken: 0, copies: 1, phase: { kind: 'capturing' } })
  })

  it('a failed send keeps the round and the file; trying again resends that file (RF13, RNF10)', async () => {
    const { session, saveMontage, print } = setup([{ ok: false, reason: 'no-paper', detail: 'x' }, { ok: true }])
    session.start(EVENT)
    capture3(session)
    expect(phase(await session.print())).toEqual({ kind: 'print-failed', reason: 'no-paper', detail: 'x', fileName: '21-45-08.jpg' })
    expect(taken(session.state())).toBe(3)
    expect(phase(await session.print())).toEqual({ kind: 'printed', fileName: '21-45-08.jpg' })
    expect(saveMontage).toHaveBeenCalledTimes(1)
    expect(print).toHaveBeenCalledTimes(2)
  })

  it('a failed write does not print and does not announce success', async () => {
    const { session, saveMontage, print } = setup()
    saveMontage.mockRejectedValueOnce(new Error('disk full'))
    session.start(EVENT)
    capture3(session)
    expect(phase(await session.print())).toEqual({ kind: 'print-failed', reason: 'save-failed', detail: 'disk full', fileName: null })
    expect(print).not.toHaveBeenCalled()
  })

  it('reports cut-unavailable without treating the sheet as printed (RF11)', async () => {
    const { session } = setup([{ ok: false, reason: 'cut-unavailable', detail: 'driver' }])
    session.start(EVENT)
    capture3(session)
    expect(phase(await session.print())).toMatchObject({ kind: 'print-failed', reason: 'cut-unavailable' })
  })

  it('frames one slot without touching its rectangle or the other slot of the same capture (RF09)', async () => {
    const { session, render } = setup()
    session.start(EVENT)
    // A slot whose photo is not taken yet cannot be framed.
    expect(session.setFraming('bottom-1', { zoom: 2, panX: 0, panY: 0, rotation: 0 })).toMatchObject({ framings: {} })
    session.addPhoto(1, jpeg(1))
    const state = session.setFraming('bottom-1', { zoom: 2, panX: 0.5, panY: -9, rotation: 190 })
    expect(state).toMatchObject({ framings: { 'bottom-1': { zoom: 2, panX: 0.5, panY: -1, rotation: -170 } } })
    if (state.kind !== 'event') throw new Error('expected an event')
    expect(state.framings['top-1']).toBeUndefined()
    expect(state.slots).toEqual(TWO_STRIPS_SEED)
    await session.settled()
    const last = render.mock.calls.at(-1)![0] as { framings: Record<string, unknown> }
    expect(last.framings).toEqual({ 'bottom-1': { zoom: 2, panX: 0.5, panY: -1, rotation: -170 } })
    // Back to the default framing drops the entry; an unknown slot changes nothing.
    expect(session.setFraming('bottom-1', { zoom: 1, panX: 0, panY: 0, rotation: 0 })).toMatchObject({ framings: {} })
    expect(session.setFraming('nope', { zoom: 2, panX: 0, panY: 0, rotation: 0 })).toMatchObject({ framings: {} })
  })

  it('uses the framing in the montage and refuses it once the file is saved; a new round resets it (RF09)', async () => {
    const { session, render } = setup()
    session.start(EVENT)
    capture3(session)
    session.setFraming('top-2', { zoom: 1.5, panX: 0, panY: 0, rotation: 0 })
    await session.print()
    const montage = render.mock.calls.find(([, output]) => output.kind === 'montage')![0] as { framings: Record<string, unknown> }
    expect(montage.framings).toEqual({ 'top-2': { zoom: 1.5, panX: 0, panY: 0, rotation: 0 } })
    expect(session.setFraming('top-2', { zoom: 3, panX: 0, panY: 0, rotation: 0 })).toMatchObject({ framings: { 'top-2': { zoom: 1.5 } } })
    expect(session.newRound()).toMatchObject({ framings: {}, taken: 0 })
  })

  it('composes one preview for a burst of framing changes', async () => {
    const { session, render } = setup()
    session.start(EVENT)
    session.addPhoto(1, jpeg(1))
    await session.settled()
    const before = render.mock.calls.length
    for (let step = 1; step <= 10; step++) session.setFraming('bottom-1', { zoom: 1 + step / 10, panX: 0, panY: 0, rotation: 0 })
    await session.settled()
    expect(render.mock.calls.length - before).toBeLessThanOrEqual(2)
    expect((render.mock.calls.at(-1)![0] as { framings: Record<string, { zoom: number }> }).framings['bottom-1']!.zoom).toBe(2)
  })

  it('Encerrar evento forgets the unprinted round (RF16)', () => {
    const { session, states } = setup()
    session.start(EVENT)
    session.addPhoto(1, jpeg(1))
    expect(session.end()).toEqual({ kind: 'idle' })
    expect(session.isOpen()).toBe(false)
    expect(states.at(-1)).toEqual({ kind: 'idle' })
  })
})
