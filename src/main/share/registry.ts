import { randomBytes } from 'node:crypto'

import type { OriginalIndex } from '@shared/files'

/** One round as the guest sees it: its original photos on disk (never the montage), by number. */
export type SharedFile = { fileName: string; photos: readonly { index: OriginalIndex; path: string }[] }

/**
 * Token → one round's original photos on disk, in memory only (DESIGN §17). A token is 128 random bits; only a token
 * handed out here maps to a file, so a URL can never name a path. The oldest entries go first once
 * `max` is reached, and the event's end forgets them all.
 */
export function createShareRegistry(max = 500, random: () => string = () => randomBytes(16).toString('base64url')) {
  const files = new Map<string, SharedFile>()
  return {
    add(file: SharedFile): string {
      let token = random()
      while (files.has(token)) token = random()
      files.set(token, file)
      while (files.size > max) files.delete(files.keys().next().value as string)
      return token
    },
    get: (token: string): SharedFile | null => files.get(token) ?? null,
    clear: () => files.clear(),
    get size() {
      return files.size
    },
  }
}

export type ShareRegistry = ReturnType<typeof createShareRegistry>
