import { isMontageFileName, isOriginalIndex, type OriginalIndex } from '../files'

/**
 * The only URLs the local photo server answers (DESIGN §17). Guests get the round's three original
 * photos, never the montage with the template: `/p/<token>` (the guest page) and `/p/<token>/foto-N.jpg`
 * (original N, 1 to 3) for one round; `/e/<token>` (the event gallery), `/e/<token>/t/<HH-mm-ss.jpg>/N`
 * (a thumbnail of original N of that round) and `/e/<token>/f/<HH-mm-ss.jpg>/N` (original N) for the
 * open event. Anything else, a directory, `..`, an encoded slash, a name this app does not write or
 * a token of the wrong shape, is `null` and gets a 404. A round token names one round; an event
 * token names one folder, and only montage names and photo numbers are accepted inside it.
 */

/** 128 random bits, base64url: 22 characters. */
export const SHARE_TOKEN_PATTERN = /^[A-Za-z0-9_-]{22}$/

/** The download name of original N on the guest page. */
export const photoFile = (index: OriginalIndex) => `foto-${index}.jpg`

export type ShareRoute =
  | { kind: 'page'; token: string }
  | { kind: 'download'; token: string; index: OriginalIndex }
  | { kind: 'gallery'; token: string }
  | { kind: 'gallery-thumb'; token: string; fileName: string; index: OriginalIndex }
  | { kind: 'gallery-file'; token: string; fileName: string; index: OriginalIndex }

/** `1`, `2` or `3` as a photo number; anything else (`01`, `4`, `1.jpg`) is `null`. */
function photoIndex(text: string | undefined): OriginalIndex | null {
  if (!text || !/^[1-9]$/.test(text)) return null
  const value = Number(text)
  return isOriginalIndex(value) ? value : null
}

export function parseShareRoute(rawUrl: string): ShareRoute | null {
  if (!rawUrl.startsWith('/')) return null
  const path = rawUrl.split(/[?#]/, 1)[0] ?? ''
  const parts = path.split('/')
  // ['', 'p', token] or ['', 'p', token, 'foto.jpg']; any other shape, `//` included, is refused.
  if (parts[0] !== '' || (parts[1] !== 'p' && parts[1] !== 'e')) return null
  const token = parts[2] ?? ''
  if (!SHARE_TOKEN_PATTERN.test(token)) return null
  if (parts[1] === 'p') {
    if (parts.length === 3) return { kind: 'page', token }
    const index = photoIndex(/^foto-(\d)\.jpg$/.exec(parts[3] ?? '')?.[1])
    if (parts.length === 4 && index !== null) return { kind: 'download', token, index }
    return null
  }
  // ['', 'e', token] or ['', 'e', token, 't' | 'f', 'HH-mm-ss.jpg', '1' | '2' | '3'].
  if (parts.length === 3) return { kind: 'gallery', token }
  const fileName = parts[4] ?? ''
  const index = photoIndex(parts[5])
  if (parts.length !== 6 || !isMontageFileName(fileName) || index === null) return null
  if (parts[3] === 't') return { kind: 'gallery-thumb', token, fileName, index }
  if (parts[3] === 'f') return { kind: 'gallery-file', token, fileName, index }
  return null
}

/** The link in the guest's QR code. */
export function sharePageUrl(host: string, port: number, token: string): string {
  return `http://${host}:${port}/p/${token}`
}

/** The link in the operator's event gallery QR code. */
export function galleryPageUrl(host: string, port: number, token: string): string {
  return `http://${host}:${port}/e/${token}`
}
