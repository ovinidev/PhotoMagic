import { createFileLog } from '../persist/log'

/** The `logger` shape electron-updater accepts. */
export type UpdaterLogger = {
  info: (message?: unknown) => void
  warn: (message?: unknown) => void
  error: (message?: unknown) => void
  debug: (message?: unknown) => void
}

/** Appends update lines to `<userData>/logs/updater.log` and echoes errors to the console. */
export function createUpdaterLogger(userData: string): UpdaterLogger {
  const write = createFileLog(userData, 'updater.log')
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
