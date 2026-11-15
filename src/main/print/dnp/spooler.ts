import type { PrinterStatus } from '../types'

/**
 * What the Windows spooler says about a queue (DESIGN §10). `status` is `PRINTER_INFO_2.Status`
 * (the same bits as .NET's `PrintQueueStatus`); `workOffline` is the "Use printer offline" switch
 * (`PRINTER_ATTRIBUTE_WORK_OFFLINE`), `null` when it could not be read.
 */
export type SpoolerQueue = { name: string; status: number; workOffline: boolean | null }

/** `PRINTER_STATUS_*` bits from winspool.h. */
export const PRINTER_STATUS = {
  paused: 0x1,
  error: 0x2,
  pendingDeletion: 0x4,
  paperJam: 0x8,
  paperOut: 0x10,
  manualFeed: 0x20,
  paperProblem: 0x40,
  offline: 0x80,
  ioActive: 0x100,
  busy: 0x200,
  printing: 0x400,
  outputBinFull: 0x800,
  notAvailable: 0x1000,
  waiting: 0x2000,
  processing: 0x4000,
  initializing: 0x8000,
  warmingUp: 0x10000,
  tonerLow: 0x20000,
  noToner: 0x40000,
  pagePunt: 0x80000,
  userIntervention: 0x100000,
  outOfMemory: 0x200000,
  doorOpen: 0x400000,
  serverUnknown: 0x800000,
  powerSave: 0x1000000,
} as const

/** The queue name the app prints to: the first whose name contains `DS-RX1` (RF11), any case. */
export function pickDnpQueue(queues: readonly Pick<SpoolerQueue, 'name'>[]): string | null {
  return queues.find((queue) => /DS-RX1/i.test(queue.name))?.name ?? null
}

/** Flags that stop a sheet from coming out but are none of the named states. English, for the log and the detail. */
const ERROR_FLAGS: ReadonlyArray<[number, string]> = [
  [PRINTER_STATUS.paperJam, 'paper jam'],
  [PRINTER_STATUS.doorOpen, 'door open'],
  [PRINTER_STATUS.paperProblem, 'paper problem'],
  [PRINTER_STATUS.outputBinFull, 'output bin full'],
  [PRINTER_STATUS.outOfMemory, 'out of memory'],
  [PRINTER_STATUS.userIntervention, 'user intervention'],
  [PRINTER_STATUS.pendingDeletion, 'pending deletion'],
  [PRINTER_STATUS.error, 'error'],
]

/**
 * Maps the spooler's flags to what the UI says. Powered off and unplugged reach Windows as
 * `OFFLINE` or `NOT_AVAILABLE` (or the queue set to work offline). `NO_TONER` is the only
 * consumable flag the spooler has, so for a dye-sub printer it is read as out of ribbon. Busy,
 * printing, warming up and power save are not errors. No flag at all is `ready`: that is what the
 * spooler reports, and whether the DS-RX1 driver fills paper and ribbon at all is checked on the
 * device (DESIGN §10). `SERVER_UNKNOWN` means the spooler itself does not know.
 */
export function statusFromSpooler(queue: Pick<SpoolerQueue, 'status' | 'workOffline'>): PrinterStatus {
  const has = (flag: number) => (queue.status & flag) !== 0
  if (has(PRINTER_STATUS.serverUnknown)) return { kind: 'unknown', detail: 'spooler reports server unknown' }
  if (queue.workOffline || has(PRINTER_STATUS.offline) || has(PRINTER_STATUS.notAvailable)) return { kind: 'offline' }
  if (has(PRINTER_STATUS.paperOut)) return { kind: 'no-paper' }
  if (has(PRINTER_STATUS.noToner)) return { kind: 'no-ribbon' }
  const errors = ERROR_FLAGS.filter(([flag]) => has(flag)).map(([, name]) => name)
  if (errors.length > 0) return { kind: 'error', detail: errors.join(', ') }
  if (has(PRINTER_STATUS.paused)) return { kind: 'paused' }
  return { kind: 'ready' }
}

/** The status of the DS-RX1 among every queue the spooler listed. */
export function dnpStatus(queues: readonly SpoolerQueue[]): { queue: string | null; status: PrinterStatus } {
  const name = pickDnpQueue(queues)
  const queue = queues.find((candidate) => candidate.name === name)
  if (!queue) return { queue: null, status: { kind: 'not-found' } }
  return { queue: queue.name, status: statusFromSpooler(queue) }
}
