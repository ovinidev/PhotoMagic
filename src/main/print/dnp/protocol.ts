import { z } from 'zod'
import type { SettingRole, TicketSetting } from './capabilities'

/**
 * Line protocol between main and `dnp-helper.ps1` (DESIGN §10). Main writes one JSON request per
 * line on the helper's stdin; the helper answers one line per request on stdout, prefixed with
 * `RESPONSE_PREFIX` so anything else PowerShell prints is ignored. Both directions are pure ASCII
 * (non-ASCII escaped as `\uXXXX`), so an accented event folder survives any console code page.
 */

export const RESPONSE_PREFIX = 'FMJ '

export type HelperRequest =
  | { action: 'list' }
  | { action: 'capabilities'; printer: string }
  | { action: 'print'; printer: string; jpegPath: string; copies: number; documentName: string; settings: TicketSetting[] }

const asciiJson = (value: unknown) => JSON.stringify(value).replace(/[\u007f-\uffff]/g, (char) => `\\u${char.charCodeAt(0).toString(16).padStart(4, '0')}`)

/** The request line for the helper's stdin. */
export function encodeRequest(id: number, request: HelperRequest): string {
  return `${asciiJson({ id, ...request })}\n`
}

const envelopeSchema = z.object({ id: z.number().int() }).passthrough()

/** `{ id, payload }` for a response line, `null` for any other output. */
export function parseResponseLine(line: string): { id: number; payload: unknown } | null {
  if (!line.startsWith(RESPONSE_PREFIX)) return null
  try {
    const parsed = envelopeSchema.safeParse(JSON.parse(line.slice(RESPONSE_PREFIX.length)))
    return parsed.success ? { id: parsed.data.id, payload: parsed.data } : null
  } catch {
    return null
  }
}

const qnameSchema = z.object({ ns: z.string(), name: z.string() })
const roleSchema = z.enum(['cut', 'media', 'orientation', 'resolution']) satisfies z.ZodType<SettingRole>

/** Any request can fail; `stage` says where. `rejected` names the setting the driver changed. */
export const helperErrorSchema = z.object({
  ok: z.literal(false),
  stage: z.enum(['exception', 'not-found', 'rejected', 'page', 'spool']),
  message: z.string(),
  role: roleSchema.optional(),
  got: qnameSchema.nullable().optional(),
})

export const listResponseSchema = z.discriminatedUnion('ok', [
  z.object({
    ok: z.literal(true),
    printers: z.array(z.object({ name: z.string(), status: z.number().int().nonnegative(), workOffline: z.boolean().nullable() })),
  }),
  helperErrorSchema,
])

const optionSchema = qnameSchema.extend({ displayName: z.string().nullable(), scored: z.record(z.string(), z.number()) })

export const capabilitiesResponseSchema = z.discriminatedUnion('ok', [
  z.object({
    ok: z.literal(true),
    features: z.array(qnameSchema.extend({ displayName: z.string().nullable(), options: z.array(optionSchema) })),
  }),
  helperErrorSchema,
])

/** After spooling, the page the driver gave (hundredths of an inch), for the log. */
export const printResponseSchema = z.discriminatedUnion('ok', [
  z.object({
    ok: z.literal(true),
    page: z.object({ width: z.number(), height: z.number() }),
  }),
  helperErrorSchema,
])

export type HelperError = z.infer<typeof helperErrorSchema>

/**
 * `powershell.exe` and its arguments. Windows PowerShell 5.1 ships with Windows 10 and 11 and
 * brings .NET Framework's System.Printing, so nothing is installed and nothing needs the network.
 * The script runs from `-EncodedCommand` as a script block read from disk, which the execution
 * policy does not block (unlike `-File`).
 */
export function helperCommand(scriptPath: string, systemRoot = 'C:\\Windows'): { file: string; args: string[] } {
  const literal = scriptPath.replace(/'/g, "''")
  const bootstrap = `$ErrorActionPreference = 'Stop'; & ([ScriptBlock]::Create([IO.File]::ReadAllText('${literal}', [Text.Encoding]::UTF8)))`
  return {
    file: `${systemRoot}\\System32\\WindowsPowerShell\\v1.0\\powershell.exe`,
    args: ['-NoLogo', '-NoProfile', '-NonInteractive', '-Sta', '-ExecutionPolicy', 'Bypass', '-EncodedCommand', Buffer.from(bootstrap, 'utf16le').toString('base64')],
  }
}
