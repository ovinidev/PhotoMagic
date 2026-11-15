import { afterEach, describe, expect, it, vi } from 'vitest'
import { createPrinterMonitor } from './monitor'
import type { PrinterStatus } from './types'

afterEach(() => {
  vi.useRealTimers()
})

describe('createPrinterMonitor', () => {
  it('reads at once, then on every tick, and notifies only on a change', async () => {
    vi.useFakeTimers()
    const statuses: PrinterStatus[] = [{ kind: 'ready' }, { kind: 'ready' }, { kind: 'no-paper' }]
    const printer = { status: vi.fn(async () => statuses.shift() ?? { kind: 'no-paper' as const }) }
    const onChange = vi.fn()
    const monitor = createPrinterMonitor({ printer, intervalMs: 1_000, onChange })
    await vi.advanceTimersByTimeAsync(0)
    expect(onChange).toHaveBeenLastCalledWith({ kind: 'ready' })
    await vi.advanceTimersByTimeAsync(1_000)
    expect(onChange).toHaveBeenCalledTimes(1)
    await vi.advanceTimersByTimeAsync(1_000)
    expect(onChange).toHaveBeenLastCalledWith({ kind: 'no-paper' })
    expect(monitor.current()).toEqual({ kind: 'no-paper' })
    monitor.stop()
    await vi.advanceTimersByTimeAsync(5_000)
    expect(printer.status).toHaveBeenCalledTimes(3)
  })

  it('shares one read between concurrent refreshes', async () => {
    const printer = { status: vi.fn(async (): Promise<PrinterStatus> => ({ kind: 'offline' })) }
    const monitor = createPrinterMonitor({ printer, intervalMs: 60_000, onChange: () => {} })
    const [a, b] = await Promise.all([monitor.refresh(), monitor.refresh()])
    expect(a).toEqual({ kind: 'offline' })
    expect(b).toBe(a)
    expect(printer.status).toHaveBeenCalledTimes(1)
    monitor.stop()
  })

  it('turns a status that throws into unknown with the reason', async () => {
    const printer = { status: vi.fn(async (): Promise<PrinterStatus> => Promise.reject(new Error('spooler stopped'))) }
    const monitor = createPrinterMonitor({ printer, intervalMs: 60_000, onChange: () => {} })
    expect(await monitor.refresh()).toEqual({ kind: 'unknown', detail: 'spooler stopped' })
    monitor.stop()
  })
})
