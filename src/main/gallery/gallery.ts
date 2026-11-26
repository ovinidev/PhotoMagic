import { readFile, readdir, stat } from 'node:fs/promises'
import { join } from 'node:path'
import sharp from 'sharp'
import { isMontageFileName } from '@shared/files'

/**
 * The event gallery (PRD §6.6, RF14): the montages this app wrote in the event folder, nothing else.
 * Renderers only ever see `HH-mm-ss.jpg` names and JPEG bytes, never a path (the TV does not see
 * the file system).
 */

/** Width of a gallery thumbnail JPEG. */
export const THUMBNAIL_WIDTH = 480

const MAX_CACHED_THUMBNAILS = 128
const thumbnails = new Map<string, { version: string; jpeg: Promise<Buffer> }>()

async function readThumbnail(path: string): Promise<Buffer> {
  const { ctimeMs, mtimeMs, size, ino } = await stat(path)
  const version = [ctimeMs, mtimeMs, size, ino].join(':')
  const cached = thumbnails.get(path)
  const entry = cached?.version === version
    ? cached
    : { version, jpeg: readFile(path).then((bytes) => sharp(bytes).resize({ width: THUMBNAIL_WIDTH }).jpeg({ quality: 80 }).toBuffer()) }

  // Refresh recently used entries and share in-flight work across the two windows.
  thumbnails.delete(path)
  thumbnails.set(path, entry)
  if (thumbnails.size > MAX_CACHED_THUMBNAILS) {
    const oldest = thumbnails.keys().next()
    if (!oldest.done) thumbnails.delete(oldest.value)
  }

  try {
    return await entry.jpeg
  } catch (error) {
    if (thumbnails.get(path) === entry) thumbnails.delete(path)
    throw error
  }
}

/** The app's montages in `folder`, newest first. Any other file is left out. */
export async function listMontages(folder: string): Promise<string[]> {
  const names = (await readdir(folder).catch(() => [] as string[])).filter(isMontageFileName)
  const dated = await Promise.all(
    names.map(async (name) => ({ name, time: await stat(join(folder, name)).then((info) => info.mtimeMs, () => 0) })),
  )
  return dated.sort((a, b) => b.time - a.time || b.name.localeCompare(a.name)).map((entry) => entry.name)
}

/** Path of a montage in the folder, or `null` for a name this app does not write (no `..`, no other file). */
export function montagePath(folder: string, fileName: string): string | null {
  return isMontageFileName(fileName) ? join(folder, fileName) : null
}

/** A montage's bytes: the file itself (`full`) or a small JPEG (`thumb`). `null` when it is not there. */
export async function readMontage(folder: string, fileName: string, size: 'thumb' | 'full'): Promise<Uint8Array | null> {
  const path = montagePath(folder, fileName)
  if (!path) return null
  try {
    return await (size === 'full' ? readFile(path) : readThumbnail(path))
  } catch {
    return null
  }
}
