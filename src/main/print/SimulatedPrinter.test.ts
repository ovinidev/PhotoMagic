import { mkdtemp, readFile, readdir, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { createSimulatedPrinter } from './SimulatedPrinter'
import { ticketFor } from './types'

async function setup() {
  const root = await mkdtemp(join(tmpdir(), 'fotomagica-print-'))
  const jpegPath = join(root, '21-45-08.jpg')
  await writeFile(jpegPath, Buffer.from([0xff, 0xd8, 0xff, 0xd9]))
  return { root, jpegPath, dir: join(root, 'simulated-prints') }
}

describe('SimulatedPrinter', () => {
  it('copies the JPEG and writes the ticket, one pair per print', async () => {
    const { jpegPath, dir } = await setup()
    const printer = createSimulatedPrinter({ dir, flags: { status: 'ready', cut: 'supported' } })
    expect(await printer.print(ticketFor(jpegPath, 3, 'two-strips'))).toEqual({ ok: true })
    expect(await printer.print(ticketFor(jpegPath, 1, 'two-strips'))).toEqual({ ok: true })
    expect((await readdir(dir)).sort()).toEqual(['001-21-45-08.jpg', '001-21-45-08.json', '002-21-45-08.jpg', '002-21-45-08.json'])
    expect(JSON.parse(await readFile(join(dir, '001-21-45-08.json'), 'utf8'))).toEqual({ jpegPath, copies: 3, mode: 'two-strips', cut: true })
  })

  it.each(['offline', 'no-paper', 'no-ribbon'] as const)('reports %s and prints nothing', async (status) => {
    const { jpegPath, dir } = await setup()
    const printer = createSimulatedPrinter({ dir, flags: { status, cut: 'supported' } })
    expect(await printer.status()).toEqual({ kind: status })
    expect(await printer.print(ticketFor(jpegPath, 1, 'one-strip'))).toMatchObject({ ok: false, reason: status })
    await expect(readdir(dir)).rejects.toThrow()
  })

  it('returns cut-unavailable when the driver refuses the cut, in both modes', async () => {
    const { jpegPath, dir } = await setup()
    const printer = createSimulatedPrinter({ dir, flags: { status: 'ready', cut: 'unsupported' } })
    expect(await printer.print(ticketFor(jpegPath, 1, 'two-strips'))).toMatchObject({ ok: false, reason: 'cut-unavailable' })
    expect(await printer.print(ticketFor(jpegPath, 1, 'one-strip'))).toMatchObject({ ok: false, reason: 'cut-unavailable' })
  })
})
