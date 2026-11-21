import { mkdir, mkdtemp, writeFile } from 'node:fs/promises'
import type { Server } from 'node:http'
import type { AddressInfo } from 'node:net'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { createEventGallery, type EventGallery } from './eventGallery'
import { createShareRegistry } from './registry'
import { startShareServer, stopServer } from './server'

describe('local photo server over localhost (DESIGN §17)', () => {
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
    server = await startShareServer({ registry, gallery: createEventGallery() }, '127.0.0.1', 0)
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

describe('event gallery over localhost (DESIGN §17)', () => {
  let server: Server
  let base: string
  let gallery: EventGallery
  let token: string
  let otherToken: string
  let jpeg: Buffer

  beforeEach(async () => {
    const sharp = (await import('sharp')).default
    jpeg = await sharp({ create: { width: 64, height: 43, channels: 3, background: '#c33' } }).jpeg().toBuffer()
    const root = await mkdtemp(join(tmpdir(), 'fotomagica-gallery-'))
    const event = join(root, 'Festa')
    const other = join(root, 'Outra')
    await mkdir(event)
    await mkdir(other)
    await writeFile(join(event, '21-45-08.jpg'), jpeg)
    await writeFile(join(event, '21-50-00.jpg'), jpeg)
    await writeFile(join(event, 'notes.txt'), 'nope')
    await writeFile(join(other, '22-00-00.jpg'), jpeg)
    await writeFile(join(root, '23-00-00.jpg'), jpeg)
    gallery = createEventGallery()
    otherToken = gallery.open({ name: 'Outra', folder: other }).token
    token = gallery.open({ name: 'Festa <b>', folder: event }).token
    server = await startShareServer({ registry: createShareRegistry(), gallery }, '127.0.0.1', 0)
    base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`
  })

  afterEach(async () => {
    await stopServer(server)
  })

  it('lists only this event\'s montages, newest first, with thumbnails and download links', async () => {
    const page = await fetch(`${base}/e/${token}`)
    expect(page.status).toBe(200)
    expect(page.headers.get('content-security-policy')).toContain("default-src 'none'")
    const html = await page.text()
    expect(html).toContain('Fotos da festa Festa &lt;b&gt;')
    expect(html).toContain(`/e/${token}/t/21-45-08.jpg`)
    expect(html).toContain(`/e/${token}/f/21-50-00.jpg`)
    expect(html).toContain('Baixar foto das 21:45:08')
    expect(html).not.toContain('22-00-00')
    expect(html).not.toContain('23-00-00')
    expect(html).not.toContain('notes.txt')
    expect(html).not.toContain('<script')

    const full = await fetch(`${base}/e/${token}/f/21-45-08.jpg`)
    expect(full.status).toBe(200)
    expect(Buffer.from(await full.arrayBuffer())).toEqual(jpeg)
    const thumb = await fetch(`${base}/e/${token}/t/21-45-08.jpg`)
    expect(thumb.status).toBe(200)
    expect(thumb.headers.get('content-type')).toBe('image/jpeg')
  })

  it.each([
    '/e/TOKEN/f/22-00-00.jpg',
    '/e/TOKEN/f/23-00-00.jpg',
    '/e/TOKEN/f/../23-00-00.jpg',
    '/e/TOKEN/f/..%2F23-00-00.jpg',
    '/e/TOKEN/f/..%2FOutra%2F22-00-00.jpg',
    '/e/TOKEN/f/notes.txt',
    '/e/TOKEN/t/notes.txt',
    '/e/TOKEN/',
    '/e/TOKEN/f/',
    '/e/OTHER',
    '/e/AAAAAAAAAAAAAAAAAAAAAA',
    '/e/',
  ])('answers 404 to %s', async (path) => {
    const response = await fetch(`${base}${path.replace('TOKEN', token).replace('OTHER', otherToken)}`)
    expect(response.status).toBe(404)
    expect(await response.text()).not.toContain('nope')
  })

  it('answers 404 once the event ends', async () => {
    gallery.close()
    expect((await fetch(`${base}/e/${token}`)).status).toBe(404)
    expect((await fetch(`${base}/e/${token}/f/21-45-08.jpg`)).status).toBe(404)
  })
})
