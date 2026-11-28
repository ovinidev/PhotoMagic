import { mkdir, mkdtemp, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { defaultShareSettings, type ShareSettings } from '@shared/share'
import { createShareService } from './service'

const port = 20000 + Math.floor(Math.random() * 20000)
const settings = (patch: Partial<ShareSettings> = {}): ShareSettings => ({
  ...defaultShareSettings(),
  enabled: true,
  port,
  hostOverride: '127.0.0.1',
  wifi: { ssid: 'FotoMagica', password: 'festa;2026', security: 'WPA', hidden: false },
  ...patch,
})

describe('share service (DESIGN §17)', () => {
  it('gives the open event one gallery link and revokes it on Encerrar evento', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'fotomagica-share-'))
    await writeFile(join(dir, '21-45-08.jpg'), Buffer.from([0xff, 0xd8, 0xff, 0xd9]))
    await mkdir(join(dir, 'Originais'))
    await writeFile(join(dir, 'Originais', '21-45-08_1.jpg'), Buffer.from([0xff, 0xd8, 0xff, 0xd9]))
    const service = createShareService({ settings: settings({ port: port + 1 }), interfaces: () => ({}), onChange: () => {} })
    await service.start()
    expect(service.state().galleryUrl).toBeNull()
    service.openEvent({ name: 'Festa', folder: dir })
    const galleryUrl = service.state().galleryUrl
    expect(galleryUrl).toMatch(new RegExp(`^http://127\\.0\\.0\\.1:${port + 1}/e/[\\w-]{22}$`))
    // Every session change reopens the same event: the link does not change.
    service.openEvent({ name: 'Festa', folder: dir })
    expect(service.state().galleryUrl).toBe(galleryUrl)
    const html = await (await fetch(galleryUrl!)).text()
    expect(html).toContain('21-45-08.jpg/1')
    service.endEvent()
    expect(service.state().galleryUrl).toBeNull()
    expect((await fetch(galleryUrl!)).status).toBe(404)
    service.openEvent({ name: 'Festa', folder: dir })
    expect(service.state().galleryUrl).not.toBe(galleryUrl)
    await service.stop()
  })

  it('hides the gallery link while the server is off', async () => {
    const service = createShareService({ settings: defaultShareSettings(), interfaces: () => ({}), onChange: () => {} })
    await service.start()
    service.openEvent({ name: 'Festa', folder: '/x' })
    expect(service.state().galleryUrl).toBeNull()
  })

  it('stays off and binds nothing until the operator turns it on', async () => {
    const service = createShareService({ settings: defaultShareSettings(), interfaces: () => ({}), onChange: () => {} })
    expect(await service.start()).toMatchObject({ status: 'off', url: null, wifiQr: null })
  })

  it('reports no address when the laptop is on no private network', async () => {
    const service = createShareService({ settings: settings({ hostOverride: '' }), interfaces: () => ({}), onChange: () => {} })
    expect(await service.start()).toMatchObject({ status: 'error', error: 'no-address' })
  })

  it('links the round originals, hides them on a new round and revokes it when the event ends', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'fotomagica-share-'))
    await writeFile(join(dir, '21-45-08_1.jpg'), Buffer.from([0xff, 0xd8, 0xff, 0xd9]))
    const states: string[] = []
    const service = createShareService({ settings: settings(), interfaces: () => ({}), onChange: (state) => states.push(state.status) })
    const started = await service.start()
    expect(started).toMatchObject({ status: 'running', host: '127.0.0.1', wifiQr: String.raw`WIFI:T:WPA;S:FotoMagica;P:festa\;2026;;` })

    service.publish({ fileName: '21-45-08.jpg', photos: [{ index: 1, path: join(dir, '21-45-08_1.jpg') }] })
    const url = service.state().url
    expect(url).toMatch(new RegExp(`^http://127\\.0\\.0\\.1:${port}/p/[\\w-]{22}$`))
    expect((await fetch(`${url}/foto-1.jpg`)).status).toBe(200)

    service.endRound()
    expect(service.state().url).toBeNull()
    expect((await fetch(`${url}/foto-1.jpg`)).status).toBe(200)

    service.endEvent()
    expect((await fetch(`${url}/foto-1.jpg`)).status).toBe(404)
    expect(service.state().galleryUrl).toBeNull()

    expect(await service.apply(settings({ enabled: false }))).toMatchObject({ status: 'off', host: null })
    await expect(fetch(`${url}`)).rejects.toThrow()
    expect(states.length).toBeGreaterThan(0)
  })
})
