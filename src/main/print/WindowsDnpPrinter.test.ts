import { describe, expect, it, vi } from 'vitest'
import { PSK } from './dnp/capabilities'
import type { HelperRequest } from './dnp/protocol'
import { PRINTER_STATUS } from './dnp/spooler'
import { createDnpPrinter } from './WindowsDnpPrinter'
import { ticketFor } from './types'

const DNP = 'urn:dnp'
const QUEUE = 'DNP DS-RX1'
const JPEG = 'C:\\Users\\Op\\Desktop\\Festa\\21-45-08.jpg'

const option = (ns: string, name: string, displayName: string | null = null, scored: Record<string, number> = {}) => ({ ns, name, displayName, scored })

const FEATURES = [
  { ns: DNP, name: 'Cut', displayName: '2inch cut', options: [option(DNP, 'Off', 'Disable'), option(DNP, 'On', 'Enable (Printer V.1.10 or later)')] },
  { ns: PSK, name: 'PageMediaSize', displayName: null, options: [option(DNP, 'PC_6x4', '(6x4)', { MediaSizeWidth: 152_400, MediaSizeHeight: 101_600 })] },
  { ns: PSK, name: 'PageOrientation', displayName: null, options: [option(PSK, 'Portrait'), option(PSK, 'Landscape')] },
]

type Script = {
  status?: number | (() => number)
  queues?: string[]
  features?: typeof FEATURES
  print?: Record<string, unknown> | (() => never)
}

/** A bridge that answers like the helper would, and records every request. */
function fakeBridge(script: Script = {}) {
  const requests: HelperRequest[] = []
  const request = vi.fn(async (req: HelperRequest): Promise<unknown> => {
    requests.push(req)
    switch (req.action) {
      case 'list': {
        const status = typeof script.status === 'function' ? script.status() : (script.status ?? 0)
        return { ok: true, printers: (script.queues ?? ['Microsoft Print to PDF', QUEUE]).map((name) => ({ name, status: name === QUEUE ? status : 0, workOffline: false })) }
      }
      case 'capabilities':
        return { ok: true, features: script.features ?? FEATURES }
      case 'print':
        if (typeof script.print === 'function') return script.print()
        return script.print ?? { ok: true, page: { width: 615, height: 413 } }
    }
  })
  return { bridge: { request }, requests }
}

const printRequests = (requests: HelperRequest[]) => requests.filter((req) => req.action === 'print')

describe('WindowsDnpPrinter print (RF11)', () => {
  it('2 tiras sends the JPG to the DS-RX1 queue with the cut Enable, 6x4 and Portrait, N copies', async () => {
    const { bridge, requests } = fakeBridge()
    const printer = createDnpPrinter({ bridge })
    expect(await printer.print(ticketFor(JPEG, 3, 'two-strips'))).toEqual({ ok: true })
    expect(printRequests(requests)).toEqual([
      {
        action: 'print',
        printer: QUEUE,
        jpegPath: JPEG,
        copies: 3,
        documentName: 'Foto Mágica 21-45-08.jpg',
        settings: [
          { role: 'cut', feature: { ns: DNP, name: 'Cut' }, option: { ns: DNP, name: 'On' }, required: true },
          { role: 'media', feature: { ns: PSK, name: 'PageMediaSize' }, option: { ns: DNP, name: 'PC_6x4' }, required: true },
          { role: 'orientation', feature: { ns: PSK, name: 'PageOrientation' }, option: { ns: PSK, name: 'Portrait' }, required: true },
        ],
      },
    ])
  })

  it('1 tira asks for the cut Disable', async () => {
    const { bridge, requests } = fakeBridge()
    await createDnpPrinter({ bridge }).print(ticketFor(JPEG, 1, 'one-strip'))
    const [sent] = printRequests(requests)
    expect(sent?.action === 'print' && sent.settings[0]).toMatchObject({ role: 'cut', option: { name: 'Off' } })
  })

  it('reads the capabilities once, not on every print', async () => {
    const { bridge, requests } = fakeBridge()
    const printer = createDnpPrinter({ bridge })
    await printer.print(ticketFor(JPEG, 1, 'two-strips'))
    await printer.print(ticketFor(JPEG, 1, 'two-strips'))
    expect(requests.filter((req) => req.action === 'capabilities')).toHaveLength(1)
  })
})

describe('WindowsDnpPrinter refuses before spooling', () => {
  it.each([
    [PRINTER_STATUS.offline, 'offline'],
    [PRINTER_STATUS.paperOut, 'no-paper'],
    [PRINTER_STATUS.noToner, 'no-ribbon'],
    [PRINTER_STATUS.paused, 'paused'],
    [PRINTER_STATUS.paperJam, 'printer-error'],
  ] as const)('spooler flag %i is %s, and nothing is printed', async (status, reason) => {
    const { bridge, requests } = fakeBridge({ status })
    expect(await createDnpPrinter({ bridge }).print(ticketFor(JPEG, 1, 'two-strips'))).toMatchObject({ ok: false, reason })
    expect(printRequests(requests)).toEqual([])
  })

  it('is not-found without a DS-RX1 queue', async () => {
    const { bridge, requests } = fakeBridge({ queues: ['HP LaserJet'] })
    expect(await createDnpPrinter({ bridge }).print(ticketFor(JPEG, 1, 'two-strips'))).toMatchObject({ ok: false, reason: 'not-found' })
    expect(printRequests(requests)).toEqual([])
  })

  it('is cut-unavailable when the driver has no cut setting', async () => {
    const { bridge, requests } = fakeBridge({ features: FEATURES.slice(1) })
    expect(await createDnpPrinter({ bridge }).print(ticketFor(JPEG, 1, 'one-strip'))).toMatchObject({ ok: false, reason: 'cut-unavailable' })
    expect(printRequests(requests)).toEqual([])
  })
})

describe('WindowsDnpPrinter after the helper answers', () => {
  it('is cut-unavailable when the driver changes the cut while validating', async () => {
    const { bridge } = fakeBridge({ print: { ok: false, stage: 'rejected', role: 'cut', got: { ns: DNP, name: 'Off' }, message: 'driver kept Off for Cut instead of On' } })
    expect(await createDnpPrinter({ bridge }).print(ticketFor(JPEG, 1, 'two-strips'))).toEqual({ ok: false, reason: 'cut-unavailable', detail: 'driver kept Off for Cut instead of On' })
  })

  it('a changed paper size is a plain failure', async () => {
    const { bridge } = fakeBridge({ print: { ok: false, stage: 'rejected', role: 'media', got: null, message: 'x' } })
    expect(await createDnpPrinter({ bridge }).print(ticketFor(JPEG, 1, 'two-strips'))).toMatchObject({ ok: false, reason: 'failed' })
  })

  it('a spool error with the paper now out says no paper', async () => {
    let calls = 0
    const { bridge } = fakeBridge({ status: () => (calls++ === 0 ? 0 : PRINTER_STATUS.paperOut), print: { ok: false, stage: 'spool', message: 'The printer is out of paper' } })
    expect(await createDnpPrinter({ bridge }).print(ticketFor(JPEG, 1, 'two-strips'))).toEqual({ ok: false, reason: 'no-paper', detail: 'The printer is out of paper' })
  })

  it('a spool error with no flag says the driver did not report why', async () => {
    const { bridge } = fakeBridge({ print: { ok: false, stage: 'spool', message: 'Win32Exception 0x6BA' } })
    expect(await createDnpPrinter({ bridge }).print(ticketFor(JPEG, 1, 'two-strips'))).toEqual({ ok: false, reason: 'unreported', detail: 'Win32Exception 0x6BA' })
  })

  it('a helper that dies mid-print is unreported, not a crash', async () => {
    const { bridge } = fakeBridge({
      print: () => {
        throw new Error('print helper exited (1)')
      },
    })
    expect(await createDnpPrinter({ bridge }).print(ticketFor(JPEG, 1, 'two-strips'))).toMatchObject({ ok: false, reason: 'unreported', detail: 'print helper exited (1)' })
  })

  it('reads the capabilities again after a failed print', async () => {
    const { bridge, requests } = fakeBridge({ print: { ok: false, stage: 'page', message: 'driver page is 413x615' } })
    const printer = createDnpPrinter({ bridge })
    expect(await printer.print(ticketFor(JPEG, 1, 'two-strips'))).toMatchObject({ ok: false, reason: 'failed' })
    await printer.print(ticketFor(JPEG, 1, 'two-strips'))
    expect(requests.filter((req) => req.action === 'capabilities')).toHaveLength(2)
  })
})

describe('WindowsDnpPrinter status (RNF10)', () => {
  it('maps the DS-RX1 queue flags', async () => {
    expect(await createDnpPrinter({ bridge: fakeBridge({ status: PRINTER_STATUS.noToner }).bridge }).status()).toEqual({ kind: 'no-ribbon' })
    expect(await createDnpPrinter({ bridge: fakeBridge({ queues: [] }).bridge }).status()).toEqual({ kind: 'not-found' })
  })

  it('says unknown, with the reason, when the helper cannot answer', async () => {
    const bridge = { request: vi.fn(async () => Promise.reject(new Error('ENOENT powershell.exe'))) }
    expect(await createDnpPrinter({ bridge }).status()).toEqual({ kind: 'unknown', detail: 'ENOENT powershell.exe' })
  })
})
