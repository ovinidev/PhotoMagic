import { randomBytes } from 'node:crypto'
import { isAbsolute, relative, resolve } from 'node:path'
import { isMontageFileName } from '@shared/files'

export type SharedEvent = { token: string; name: string; folder: string }

/**
 * The open event's gallery token (DESIGN §17), in memory only. One event, one token: opening the
 * same folder again keeps it, another event replaces it, and `close` (on `Encerrar evento`) forgets
 * it so its URL answers 404 from then on. A fresh app start never reuses an old token.
 */
export function createEventGallery(random: () => string = () => randomBytes(16).toString('base64url')) {
  let current: SharedEvent | null = null
  return {
    open(event: { name: string; folder: string }): SharedEvent {
      if (current?.folder === event.folder) return current
      current = { token: random(), name: event.name, folder: event.folder }
      return current
    },
    get: (token: string): SharedEvent | null => (current && current.token === token ? current : null),
    current: (): SharedEvent | null => current,
    close(): void {
      current = null
    },
  }
}

export type EventGallery = ReturnType<typeof createEventGallery>

/**
 * The path of a montage inside the event folder, or `null`: only an `HH-mm-ss.jpg` name, resolved
 * and checked to stay directly inside `folder`, so no `..`, separator or absolute path gets out.
 */
export function resolveEventFile(folder: string, fileName: string): string | null {
  if (!isMontageFileName(fileName)) return null
  const root = resolve(folder)
  const path = resolve(root, fileName)
  const rel = relative(root, path)
  if (!rel || rel.startsWith('..') || isAbsolute(rel) || rel !== fileName) return null
  return path
}
