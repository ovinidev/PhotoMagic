import { spawn } from 'node:child_process'
import { mkdirSync, writeFileSync } from 'node:fs'
import { join, win32 } from 'node:path'
import helperScript from './dnp/dnp-helper.ps1?raw'
import { createHelperBridge, type HelperBridge } from './dnp/bridge'
import { planTicket, type Capabilities } from './dnp/capabilities'
import { capabilitiesResponseSchema, helperCommand, listResponseSchema, printResponseSchema, type HelperRequest } from './dnp/protocol'
import { dnpStatus } from './dnp/spooler'
import type { PrintFailure, Printer, PrinterStatus, PrintResult } from './types'

/**
 * The DS-RX1 on the Windows spooler (DESIGN §10). A long-lived Windows PowerShell 5.1 helper does
 * the Windows part: list the queues with their status, read the queue's PrintCapabilities, and
 * print the montage silently with a PrintTicket that carries the 2" cut, 6×4 paper, Portrait and
 * 300 DPI, converted to the driver's DEVMODE. Everything that decides something lives here and in
 * `dnp/`, as plain TypeScript with tests.
 */

const TIMEOUTS: Record<HelperRequest['action'], number> = {
  // The first request also loads System.Printing; later ones answer in well under a second.
  list: 20_000,
  capabilities: 30_000,
  print: 120_000,
}

/** States in which nothing is spooled: the sheet would sit in the Windows queue instead of coming out. */
const BLOCKING: Partial<Record<PrinterStatus['kind'], PrintFailure>> = {
  offline: 'offline',
  'no-paper': 'no-paper',
  'no-ribbon': 'no-ribbon',
  paused: 'paused',
  error: 'printer-error',
  'not-found': 'not-found',
}

const message = (error: unknown) => (error instanceof Error ? error.message : String(error))

function blocked(status: PrinterStatus): PrintResult | null {
  const reason = BLOCKING[status.kind]
  if (!reason) return null
  return { ok: false, reason, detail: 'detail' in status ? status.detail : `spooler: ${status.kind}` }
}

/** The printer over any helper bridge; the tests hand in a fake one. */
export function createDnpPrinter({ bridge, log = () => {} }: { bridge: Pick<HelperBridge, 'request'>; log?: (line: string) => void }): Printer {
  /** PrintCapabilities do not change while the app runs; a failed print drops the cache anyway. */
  const capabilitiesCache = new Map<string, Capabilities>()

  const readStatus = async () => {
    const response = listResponseSchema.parse(await bridge.request({ action: 'list' }))
    if (!response.ok) throw new Error(`${response.stage}: ${response.message}`)
    return dnpStatus(response.printers)
  }

  const readCapabilities = async (queue: string): Promise<Capabilities | { error: PrintResult }> => {
    const cached = capabilitiesCache.get(queue)
    if (cached) return cached
    const response = capabilitiesResponseSchema.parse(await bridge.request({ action: 'capabilities', printer: queue }))
    if (!response.ok) {
      return { error: { ok: false, reason: response.stage === 'not-found' ? 'not-found' : 'failed', detail: `capabilities: ${response.message}` } }
    }
    const capabilities = { features: response.features }
    capabilitiesCache.set(queue, capabilities)
    return capabilities
  }

  /** After a send that failed, the spooler may now say why; if it does not, say the driver did not report it. */
  const explain = async (detail: string): Promise<PrintResult> => {
    try {
      const { status } = await readStatus()
      const known = blocked(status)
      if (known) return { ...known, detail } as PrintResult
    } catch {
      // The status is what we could not read; fall through.
    }
    return { ok: false, reason: 'unreported', detail }
  }

  const print = async (ticket: Parameters<Printer['print']>[0]): Promise<PrintResult> => {
    let current: Awaited<ReturnType<typeof readStatus>>
    try {
      current = await readStatus()
    } catch (error) {
      return { ok: false, reason: 'failed', detail: `could not read the printers: ${message(error)}` }
    }
    const { queue, status } = current
    if (!queue) return { ok: false, reason: 'not-found', detail: 'no queue whose name contains DS-RX1' }
    const stop = blocked(status)
    if (stop) return stop
    // `unknown` goes ahead: the spooler not knowing is not a reason to keep the guests waiting.

    const capabilities = await readCapabilities(queue)
    if ('error' in capabilities) return capabilities.error
    const plan = planTicket(capabilities, ticket.cut)
    if (!plan.ok) return plan

    const response = printResponseSchema.parse(
      await bridge.request({
        action: 'print',
        printer: queue,
        jpegPath: ticket.jpegPath,
        copies: ticket.copies,
        documentName: `Foto Mágica ${win32.basename(ticket.jpegPath)}`,
        settings: plan.settings,
      }),
    )
    if (response.ok) {
      log(`printed ${ticket.jpegPath} ×${ticket.copies} on ${queue}, cut ${ticket.cut ? 'on' : 'off'}, page ${response.page.width}x${response.page.height}`)
      return { ok: true }
    }
    capabilitiesCache.delete(queue)
    switch (response.stage) {
      case 'rejected':
        return { ok: false, reason: response.role === 'cut' ? 'cut-unavailable' : 'failed', detail: response.message }
      case 'not-found':
        return { ok: false, reason: 'not-found', detail: response.message }
      case 'page':
        return { ok: false, reason: 'failed', detail: response.message }
      case 'spool':
      case 'exception':
        return explain(response.message)
    }
  }

  return {
    status: async () => {
      try {
        return (await readStatus()).status
      } catch (error) {
        return { kind: 'unknown', detail: message(error) }
      }
    },
    print: async (ticket) => {
      try {
        return await print(ticket)
      } catch (error) {
        // The helper died, timed out or answered something unexpected.
        return explain(message(error))
      }
    },
  }
}

/**
 * The real thing: writes the helper script under `helperDir` and starts Windows PowerShell on the
 * first request. Lines go to the console and to `file` (`userData/logs/print.log`). `dispose` stops
 * the helper when the app quits.
 */
export function createWindowsDnpPrinter({ helperDir, file = () => {} }: { helperDir: string; file?: (line: string) => void }): Printer & { dispose: () => void } {
  const scriptPath = join(helperDir, 'dnp-helper.ps1')
  let written = false
  const log = (line: string) => {
    console.info(`[print] ${line}`)
    file(line)
  }

  const bridge = createHelperBridge({
    timeoutMs: (request) => TIMEOUTS[request.action],
    spawn: () => {
      if (!written) {
        mkdirSync(helperDir, { recursive: true })
        // Rewritten on every launch, so an update always runs its own script.
        writeFileSync(scriptPath, helperScript, 'utf8')
        written = true
      }
      const { file, args } = helperCommand(scriptPath, process.env['SystemRoot'] ?? 'C:\\Windows')
      const child = spawn(file, args, { windowsHide: true, stdio: ['pipe', 'pipe', 'pipe'] })
      child.stderr.setEncoding('utf8')
      child.stderr.on('data', (chunk: string) => log(`helper: ${chunk.trim()}`))
      return child
    },
  })

  return { ...createDnpPrinter({ bridge, log }), dispose: bridge.dispose }
}
