import { mkdir, readdir, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { montageFileName } from '@shared/files'

/**
 * Writes the montage as `HH-mm-ss.jpg` (local time) in the event folder, with `-2`, `-3` for the
 * same second (RF12). `wx` never overwrites: a name taken between the listing and the write is
 * retried with the next suffix. The folder is recreated if the operator deleted or moved it during
 * the event: losing the print over a missing folder is worse than bringing it back.
 */
export async function saveMontage(folder: string, jpeg: Uint8Array, now: () => Date = () => new Date()): Promise<{ fileName: string; path: string }> {
  const date = now()
  await mkdir(folder, { recursive: true })
  for (let attempt = 0; attempt < 20; attempt++) {
    const fileName = montageFileName(date, await readdir(folder))
    const path = join(folder, fileName)
    try {
      await writeFile(path, jpeg, { flag: 'wx' })
      return { fileName, path }
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error
    }
  }
  throw new Error('Could not find a free montage file name')
}
