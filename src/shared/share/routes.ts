/**
 * The only URLs the local photo server answers (DESIGN §15): `/p/<token>` (the guest page) and
 * `/p/<token>/foto.jpg` (the montage download). Anything else, a directory, `..`, an encoded slash
 * or a token of the wrong shape, is `null` and gets a 404. The token is the only key: the server
 * never builds a file path from the URL.
 */

/** 128 random bits, base64url: 22 characters. */
export const SHARE_TOKEN_PATTERN = /^[A-Za-z0-9_-]{22}$/

export const DOWNLOAD_FILE = 'foto.jpg'

export type ShareRoute = { kind: 'page' | 'download'; token: string }

export function parseShareRoute(rawUrl: string): ShareRoute | null {
  if (!rawUrl.startsWith('/')) return null
  const path = rawUrl.split(/[?#]/, 1)[0] ?? ''
  const parts = path.split('/')
  // ['', 'p', token] or ['', 'p', token, 'foto.jpg']; any other shape, `//` included, is refused.
  if (parts[0] !== '' || parts[1] !== 'p') return null
  const token = parts[2] ?? ''
  if (!SHARE_TOKEN_PATTERN.test(token)) return null
  if (parts.length === 3) return { kind: 'page', token }
  if (parts.length === 4 && parts[3] === DOWNLOAD_FILE) return { kind: 'download', token }
  return null
}

/** The link in the guest's QR code. */
export function sharePageUrl(host: string, port: number, token: string): string {
  return `http://${host}:${port}/p/${token}`
}
