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
    const bytes = await readFile(path)
    if (size === 'full') return bytes
    return await sharp(bytes).resize({ width: THUMBNAIL_WIDTH }).jpeg({ quality: 80 }).toBuffer()
  } catch {
    return null
  }
}
