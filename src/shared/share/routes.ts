import { isMontageFileName } from '../files'

/**
 * The only URLs the local photo server answers (DESIGN §17): `/p/<token>` (the guest page) and
 * `/p/<token>/foto.jpg` (the montage download) for one round; `/e/<token>` (the event gallery),
 * `/e/<token>/t/<HH-mm-ss.jpg>` (a thumbnail) and `/e/<token>/f/<HH-mm-ss.jpg>` (the montage) for
 * the open event. Anything else, a directory, `..`, an encoded slash, a name this app does not
 * write or a token of the wrong shape, is `null` and gets a 404. A round token names one file; an
 * event token names one folder, and only montage names are accepted inside it.
 */

/** 128 random bits, base64url: 22 characters. */
export const SHARE_TOKEN_PATTERN = /^[A-Za-z0-9_-]{22}$/

export const DOWNLOAD_FILE = 'foto.jpg'

export type ShareRoute =
  | { kind: 'page'; token: string }
  | { kind: 'download'; token: string }
  | { kind: 'gallery'; token: string }
  | { kind: 'gallery-thumb'; token: string; fileName: string }
  | { kind: 'gallery-file'; token: string; fileName: string }

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
    if (parts.length === 4 && parts[3] === DOWNLOAD_FILE) return { kind: 'download', token }
    return null
  }
  // ['', 'e', token] or ['', 'e', token, 't' | 'f', 'HH-mm-ss.jpg'].
  if (parts.length === 3) return { kind: 'gallery', token }
  const fileName = parts[4] ?? ''
  if (parts.length !== 5 || !isMontageFileName(fileName)) return null
  if (parts[3] === 't') return { kind: 'gallery-thumb', token, fileName }
  if (parts[3] === 'f') return { kind: 'gallery-file', token, fileName }
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
