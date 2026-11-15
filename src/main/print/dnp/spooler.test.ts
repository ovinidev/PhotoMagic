import { describe, expect, it } from 'vitest'
import { PRINTER_STATUS as S, dnpStatus, pickDnpQueue, statusFromSpooler } from './spooler'

const queue = (status: number, workOffline: boolean | null = false) => ({ status, workOffline })

describe('pickDnpQueue (RF11)', () => {
  it('picks the queue whose name contains DS-RX1, in any case', () => {
    expect(pickDnpQueue([{ name: 'Microsoft Print to PDF' }, { name: 'DNP DS-RX1' }])).toBe('DNP DS-RX1')
    expect(pickDnpQueue([{ name: 'dnp ds-rx1 (Cópia 1)' }])).toBe('dnp ds-rx1 (Cópia 1)')
  })

  it('returns null without a DS-RX1, even with a similar model', () => {
    expect(pickDnpQueue([{ name: 'DNP DS620' }, { name: 'DNP DS-R1' }])).toBeNull()
    expect(pickDnpQueue([])).toBeNull()
  })
})

describe('statusFromSpooler (RNF10)', () => {
  it('reads no flag as ready, and busy or printing as ready too', () => {
    expect(statusFromSpooler(queue(0))).toEqual({ kind: 'ready' })
    expect(statusFromSpooler(queue(S.printing | S.busy | S.warmingUp | S.powerSave))).toEqual({ kind: 'ready' })
  })

  it('reads powered off, unplugged and work offline as offline', () => {
    expect(statusFromSpooler(queue(S.offline))).toEqual({ kind: 'offline' })
    expect(statusFromSpooler(queue(S.notAvailable))).toEqual({ kind: 'offline' })
    expect(statusFromSpooler(queue(0, true))).toEqual({ kind: 'offline' })
  })

  it('reads paper out as no paper and no toner as no ribbon', () => {
    expect(statusFromSpooler(queue(S.paperOut | S.error))).toEqual({ kind: 'no-paper' })
    expect(statusFromSpooler(queue(S.noToner))).toEqual({ kind: 'no-ribbon' })
  })

  it('offline wins over paper, and paper over ribbon', () => {
    expect(statusFromSpooler(queue(S.offline | S.paperOut | S.noToner))).toEqual({ kind: 'offline' })
    expect(statusFromSpooler(queue(S.paperOut | S.noToner))).toEqual({ kind: 'no-paper' })
  })

  it('names other error flags instead of guessing a state', () => {
    expect(statusFromSpooler(queue(S.paperJam | S.doorOpen))).toEqual({ kind: 'error', detail: 'paper jam, door open' })
    expect(statusFromSpooler(queue(S.error))).toEqual({ kind: 'error', detail: 'error' })
  })

  it('reads a paused queue as paused', () => {
    expect(statusFromSpooler(queue(S.paused))).toEqual({ kind: 'paused' })
  })

  it('says unknown when the spooler itself does not know', () => {
    expect(statusFromSpooler(queue(S.serverUnknown))).toMatchObject({ kind: 'unknown' })
  })

  it('treats an unreadable work-offline switch as not offline', () => {
    expect(statusFromSpooler(queue(0, null))).toEqual({ kind: 'ready' })
  })
})

describe('dnpStatus', () => {
  it('is not-found without a DS-RX1 queue, whatever the others say', () => {
    expect(dnpStatus([{ name: 'HP', status: S.paperOut, workOffline: false }])).toEqual({ queue: null, status: { kind: 'not-found' } })
  })

  it('reads the DS-RX1 queue only', () => {
    const queues = [
      { name: 'HP', status: S.paperOut, workOffline: false },
      { name: 'DNP DS-RX1', status: S.noToner, workOffline: false },
    ]
    expect(dnpStatus(queues)).toEqual({ queue: 'DNP DS-RX1', status: { kind: 'no-ribbon' } })
  })
})
