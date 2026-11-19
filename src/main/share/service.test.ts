import { mkdtemp, writeFile } from 'node:fs/promises'
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
  it('stays off and binds nothing until the operator turns it on', async () => {
    const service = createShareService({ settings: defaultShareSettings(), interfaces: () => ({}), onChange: () => {} })
    expect(await service.start()).toMatchObject({ status: 'off', url: null, wifiQr: null })
  })

  it('reports no address when the laptop is on no private network', async () => {
    const service = createShareService({ settings: settings({ hostOverride: '' }), interfaces: () => ({}), onChange: () => {} })
    expect(await service.start()).toMatchObject({ status: 'error', error: 'no-address' })
  })

  it('links the round montage, hides it on a new round and revokes it when the event ends', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'fotomagica-share-'))
    await writeFile(join(dir, '21-45-08.jpg'), Buffer.from([0xff, 0xd8, 0xff, 0xd9]))
    const states: string[] = []
    const service = createShareService({ settings: settings(), interfaces: () => ({}), onChange: (state) => states.push(state.status) })
    const started = await service.start()
    expect(started).toMatchObject({ status: 'running', host: '127.0.0.1', wifiQr: String.raw`WIFI:T:WPA;S:FotoMagica;P:festa\;2026;;` })

    service.publish({ path: join(dir, '21-45-08.jpg'), fileName: '21-45-08.jpg' })
    const url = service.state().url
    expect(url).toMatch(new RegExp(`^http://127\\.0\\.0\\.1:${port}/p/[\\w-]{22}$`))
    expect((await fetch(`${url}/foto.jpg`)).status).toBe(200)

    service.endRound()
    expect(service.state().url).toBeNull()
    expect((await fetch(`${url}/foto.jpg`)).status).toBe(200)

    service.endEvent()
    expect((await fetch(`${url}/foto.jpg`)).status).toBe(404)

    expect(await service.apply(settings({ enabled: false }))).toMatchObject({ status: 'off', host: null })
    await expect(fetch(`${url}`)).rejects.toThrow()
    expect(states.length).toBeGreaterThan(0)
  })
})
