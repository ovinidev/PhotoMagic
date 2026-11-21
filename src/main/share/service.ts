import type { Server } from 'node:http'
import type { ShareState } from '@shared/ipc'
import { galleryPageUrl, pickLanIp, sharePageUrl, wifiQrText, type InterfaceAddress, type ShareSettings } from '@shared/share'
import { createEventGallery } from './eventGallery'
import { createShareRegistry, type SharedFile } from './registry'
import { startShareServer, stopServer } from './server'

export type ShareServiceDeps = {
  settings: ShareSettings
  interfaces: () => Record<string, readonly InterfaceAddress[] | undefined>
  onChange: (state: ShareState) => void
  log?: (message: string, error?: unknown) => void
}

/**
 * Offline photo download (DESIGN §17): owns the token registry and the local server, restarts it
 * when the operator saves the settings, and tells both windows the current round's link. The
 * server binds only the laptop's address on the guests' Wi-Fi, never every interface.
 */
export function createShareService(deps: ShareServiceDeps) {
  const registry = createShareRegistry()
  const gallery = createEventGallery()
  let settings = deps.settings
  let server: Server | null = null
  let host: string | null = null
  let error: ShareState['error'] = null
  let current: string | null = null
  // One start/stop at a time: two quick saves never leave two servers on the port.
  let queue: Promise<unknown> = Promise.resolve()

  const state = (): ShareState => {
    const running = server !== null && host !== null
    const ssid = settings.wifi.ssid
    return {
      status: running ? 'running' : settings.enabled ? 'error' : 'off',
      error: running ? null : settings.enabled ? error : null,
      host,
      port: settings.port,
      ssid,
      wifiQr: settings.enabled && ssid ? wifiQrText(settings.wifi) : null,
      url: running && current && host ? sharePageUrl(host, settings.port, current) : null,
      galleryUrl: running && host && gallery.current() ? galleryPageUrl(host, settings.port, gallery.current()!.token) : null,
    }
  }
  const emit = () => deps.onChange(state())

  async function restart(): Promise<void> {
    if (server) await stopServer(server)
    server = null
    error = null
    host = settings.enabled ? pickLanIp(deps.interfaces(), settings.hostOverride) : null
    if (!settings.enabled) return
    if (!host) {
      error = 'no-address'
      return
    }
    try {
      server = await startShareServer({ registry, gallery }, host, settings.port)
    } catch (failure) {
      const code = (failure as NodeJS.ErrnoException).code
      error = code === 'EADDRINUSE' ? 'port-in-use' : 'failed'
      deps.log?.(`share server could not listen on ${host}:${settings.port}`, failure)
    }
  }

  const run = (task: () => Promise<void>): Promise<ShareState> => {
    const next = queue.then(task).then(() => {
      emit()
      return state()
    })
    queue = next.catch(() => undefined)
    return next
  }

  return {
    state,
    settings: () => settings,
    start: () => run(restart),
    apply: (next: ShareSettings) =>
      run(async () => {
        settings = next
        await restart()
      }),
    /** A montage was saved: it becomes the round's link. */
    publish(file: SharedFile): void {
      current = registry.add(file)
      emit()
    },
    /** A new round: its link goes from the screens, but phones that have it can still download. */
    endRound(): void {
      if (current === null) return
      current = null
      emit()
    },
    /** An event is open: its gallery gets one token (the same one while the event lasts). */
    openEvent(event: { name: string; folder: string }): void {
      const before = gallery.current()
      if (gallery.open(event) !== before) emit()
    },
    /** The event ended (`Encerrar evento`): every link, the gallery's included, stops working. */
    endEvent(): void {
      if (current === null && registry.size === 0 && gallery.current() === null) return
      gallery.close()
      registry.clear()
      current = null
      emit()
    },
    stop: () =>
      run(async () => {
        if (server) await stopServer(server)
        server = null
      }),
  }
}

export type ShareService = ReturnType<typeof createShareService>
