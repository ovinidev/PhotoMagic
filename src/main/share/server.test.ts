import { mkdtemp, writeFile } from 'node:fs/promises'
import type { Server } from 'node:http'
import type { AddressInfo } from 'node:net'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { createShareRegistry } from './registry'
import { startShareServer, stopServer } from './server'

describe('local photo server over localhost (DESIGN §15)', () => {
  let server: Server
  let base: string
  let token: string
  const jpeg = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3, 0xff, 0xd9])

  beforeEach(async () => {
    const dir = await mkdtemp(join(tmpdir(), 'fotomagica-share-'))
    await writeFile(join(dir, '21-45-08.jpg'), jpeg)
    await writeFile(join(dir, 'secret.txt'), 'nope')
    const registry = createShareRegistry()
    token = registry.add({ path: join(dir, '21-45-08.jpg'), fileName: '21-45-08.jpg' })
    server = await startShareServer(registry, '127.0.0.1', 0)
    base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`
  })

  afterEach(async () => {
    await stopServer(server)
  })

  it('serves the pt-BR page and the montage for a known token', async () => {
    const page = await fetch(`${base}/p/${token}`)
    expect(page.status).toBe(200)
    const html = await page.text()
    expect(html).toContain('Baixar foto')
    expect(html).toContain(`/p/${token}/foto.jpg`)

    const photo = await fetch(`${base}/p/${token}/foto.jpg`)
    expect(photo.status).toBe(200)
    expect(photo.headers.get('content-type')).toBe('image/jpeg')
    expect(Buffer.from(await photo.arrayBuffer())).toEqual(jpeg)
  })

  it.each(['/', '/p/', '/p/AAAAAAAAAAAAAAAAAAAAAA', `/p/TOKEN/../secret.txt`, `/p/TOKEN/..%2Fsecret.txt`, '/secret.txt', '/p/TOKEN/secret.txt'])('answers 404 to %s', async (path) => {
    const response = await fetch(`${base}${path.replace('TOKEN', token)}`)
    expect(response.status).toBe(404)
    expect(await response.text()).not.toContain('nope')
  })

  it('refuses writes', async () => {
    expect((await fetch(`${base}/p/${token}`, { method: 'POST', body: 'x' })).status).toBe(405)
  })
})
