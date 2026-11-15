import { IPC_CHANNELS, type GalleryReprintResult } from '@shared/ipc'
import { listMontages, montagePath, readMontage } from '../gallery'
import { ticketFor, type Printer } from '../print'
import type { Session } from '../session'
import { broadcast, handleInvoke } from './handle'

/** `gallery:*` (PRD §6.6, RF14): the open event's montages, by name only. */
export function registerGalleryHandlers(deps: { session: Session; printer: Printer }): void {
  const { session } = deps

  handleInvoke(IPC_CHANNELS.galleryList, async () => {
    const open = session.openEvent()
    return { fileNames: open ? await listMontages(open.folder) : [] }
  })

  handleInvoke(IPC_CHANNELS.galleryGet, async ({ fileName, size }) => {
    const open = session.openEvent()
    return { jpeg: open ? await readMontage(open.folder, fileName, size) : null }
  })

  handleInvoke(IPC_CHANNELS.galleryReprint, async ({ fileName }): Promise<GalleryReprintResult> => {
    const open = session.openEvent()
    const path = open ? montagePath(open.folder, fileName) : null
    if (!open || !path || !(await listMontages(open.folder)).includes(fileName)) return { ok: false, reason: 'missing', detail: '' }
    try {
      const result = await deps.printer.print(ticketFor(path, 1, open.mode))
      return result.ok ? { ok: true } : { ok: false, reason: result.reason, detail: result.detail }
    } catch (error) {
      return { ok: false, reason: 'failed', detail: error instanceof Error ? error.message : String(error) }
    }
  })
}

/** Tells both windows a new montage is in the event folder. */
export function broadcastGalleryChanged(): void {
  broadcast(IPC_CHANNELS.galleryChanged, {})
}
