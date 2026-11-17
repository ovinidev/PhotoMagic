import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { createFileLog, LOGS_DIR } from './log'

let dir: string

afterEach(async () => {
  if (dir) await rm(dir, { recursive: true, force: true })
})

describe('createFileLog', () => {
  it('appends timestamped lines in order under <userData>/logs', async () => {
    dir = await mkdtemp(join(tmpdir(), 'fm-log-'))
    const log = createFileLog(dir, 'test.log')
    log('info', 'first')
    log('error', new Error('boom'))
    log('warn', { code: 7 })
    await log.flushed()
    const lines = (await readFile(join(dir, LOGS_DIR, 'test.log'), 'utf8')).trim().split('\n')
    expect(lines[0]).toMatch(/^\d{4}-\d{2}-\d{2}T.* \[info\] first$/)
    expect(lines[1]).toContain('[error] Error: boom')
    expect(lines.at(-1)).toMatch(/\[warn\] \{"code":7\}$/)
  })

  it('never throws when the folder cannot be created', async () => {
    dir = await mkdtemp(join(tmpdir(), 'fm-log-'))
    const blocker = join(dir, 'file')
    await writeFile(blocker, '')
    const log = createFileLog(blocker, 'test.log')
    expect(() => log('info', 'x')).not.toThrow()
    await expect(log.flushed()).resolves.toBeUndefined()
  })
})
