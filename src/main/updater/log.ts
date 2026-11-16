import { appendFile, mkdir } from 'node:fs/promises'
import { join } from 'node:path'

/** The `logger` shape electron-updater accepts. */
export type UpdaterLogger = {
  info: (message?: unknown) => void
  warn: (message?: unknown) => void
  error: (message?: unknown) => void
  debug: (message?: unknown) => void
}

function format(message: unknown): string {
  if (message instanceof Error) return message.stack ?? message.message
  return typeof message === 'string' ? message : JSON.stringify(message)
}

/**
 * Appends update lines to `<userData>/logs/updater.log` (never the event folder) and echoes errors
 * to the console. Writing the log never throws: a failure here must not reach the operator.
 */
export function createUpdaterLogger(userData: string): UpdaterLogger {
  const folder = join(userData, 'logs')
  const file = join(folder, 'updater.log')
  let queue: Promise<unknown> = mkdir(folder, { recursive: true }).catch(() => {})

  const write = (level: string, message: unknown) => {
    const line = `${new Date().toISOString()} [${level}] ${format(message)}\n`
    queue = queue.then(() => appendFile(file, line)).catch(() => {})
  }

  return {
    info: (message) => write('info', message),
    warn: (message) => write('warn', message),
    error: (message) => {
      console.error('[updater]', message)
      write('error', message)
    },
    debug: () => {},
  }
}
