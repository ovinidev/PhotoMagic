import { mkdir, readdir, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { ORIGINALS_DIR, montageFileName, originalFileName, type OriginalIndex } from '@shared/files'

export type SavedPhoto = { index: OriginalIndex; fileName: string; path: string }
export type SavedMontage = { fileName: string; path: string; photos: SavedPhoto[] }

/**
 * Writes the montage as `HH-mm-ss.jpg` (local time) in the event folder, with `-2`, `-3` for the
 * same second (RF12). `wx` never overwrites: a name taken between the listing and the write is
 * retried with the next suffix. The folder is recreated if the operator deleted or moved it during
 * the event: losing the print over a missing folder is worse than bringing it back.
 *
 * Then the round's original captures go to `Originais/` with the montage's name and `_1` … `_3`
 * (DESIGN §17): the guests download those. They never block the print: one that cannot be written
 * is left out and logged.
 */
export async function saveMontage(
  folder: string,
  jpeg: Uint8Array,
  originals: readonly (readonly [OriginalIndex, Uint8Array])[] = [],
  now: () => Date = () => new Date(),
  log: (message: string, error: unknown) => void = () => {},
): Promise<SavedMontage> {
  const date = now()
  await mkdir(folder, { recursive: true })
  for (let attempt = 0; attempt < 20; attempt++) {
    const fileName = montageFileName(date, await readdir(folder))
    const path = join(folder, fileName)
    try {
      await writeFile(path, jpeg, { flag: 'wx' })
      return { fileName, path, photos: await saveOriginals(folder, fileName, originals, log) }
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error
    }
  }
  throw new Error('Could not find a free montage file name')
}

async function saveOriginals(
  folder: string,
  montage: string,
  originals: readonly (readonly [OriginalIndex, Uint8Array])[],
  log: (message: string, error: unknown) => void,
): Promise<SavedPhoto[]> {
  if (originals.length === 0) return []
  const dir = join(folder, ORIGINALS_DIR)
  const saved: SavedPhoto[] = []
  try {
    await mkdir(dir, { recursive: true })
  } catch (error) {
    log(`could not create ${dir}`, error)
    return saved
  }
  for (const [index, bytes] of originals) {
    const fileName = originalFileName(montage, index)
    const path = join(dir, fileName)
    try {
      await writeFile(path, bytes)
      saved.push({ index, fileName, path })
    } catch (error) {
      log(`could not write ${path}`, error)
    }
  }
  return saved
}

