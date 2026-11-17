import { appendFile, mkdir } from 'node:fs/promises'
import { join } from 'node:path'

export const LOGS_DIR = 'logs'

export type LogLevel = 'info' | 'warn' | 'error'
export type FileLog = (level: LogLevel, message: unknown) => void

function format(message: unknown): string {
  if (message instanceof Error) return message.stack ?? message.message
  return typeof message === 'string' ? message : JSON.stringify(message)
}

/**
 * Appends timestamped lines to `<userData>/logs/<fileName>` (never the event folder), in order.
 * A packaged Windows app has no console, so these files are what the owner sends back after a
 * test on the device. Writing never throws: a failure here must not reach the operator.
 */
export function createFileLog(userData: string, fileName: string): FileLog & { flushed: () => Promise<unknown> } {
  const folder = join(userData, LOGS_DIR)
  const file = join(folder, fileName)
  let queue: Promise<unknown> = mkdir(folder, { recursive: true }).catch(() => {})
  const write: FileLog = (level, message) => {
    const line = `${new Date().toISOString()} [${level}] ${format(message)}\n`
    queue = queue.then(() => appendFile(file, line)).catch(() => {})
  }
  return Object.assign(write, { flushed: () => queue })
}
