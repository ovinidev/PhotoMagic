import { createReadStream } from 'node:fs'
import { readFile, stat } from 'node:fs/promises'
import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http'
import sharp from 'sharp'
import { parseShareRoute } from '@shared/share'
import { listMontages, THUMBNAIL_WIDTH } from '../gallery'
import { listOriginals, resolveOriginalFile, type EventGallery } from './eventGallery'
import { galleryPage, sharePage } from './page'
import type { ShareRegistry } from './registry'

/** What the server can answer: each round's originals by token and the open event's folder by token. */
export type ShareSources = { registry: ShareRegistry; gallery: EventGallery }

const BASE_HEADERS = {
  'Cache-Control': 'no-store',
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'no-referrer',
  'X-Frame-Options': 'DENY',
}

function notFound(res: ServerResponse): void {
  res.writeHead(404, { ...BASE_HEADERS, 'Content-Type': 'text/plain; charset=utf-8' })
  res.end('Não encontrado')
}

function sendHtml(req: IncomingMessage, res: ServerResponse, body: string): void {
  res.writeHead(200, {
    ...BASE_HEADERS,
    'Content-Type': 'text/html; charset=utf-8',
    'Content-Length': Buffer.byteLength(body),
    'Content-Security-Policy': "default-src 'none'; img-src 'self'; style-src 'unsafe-inline'",
  })
  res.end(req.method === 'HEAD' ? undefined : body)
}

async function sendJpeg(req: IncomingMessage, res: ServerResponse, path: string, fileName: string): Promise<void> {
  const info = await stat(path).catch(() => null)
  if (!info?.isFile()) return notFound(res)
  res.writeHead(200, {
    ...BASE_HEADERS,
    'Content-Type': 'image/jpeg',
    'Content-Length': info.size,
    'Content-Disposition': `inline; filename="foto-magica-${fileName.replace(/[^\w.-]/g, '')}"`,
  })
  if (req.method === 'HEAD') {
    res.end()
    return
  }
  const stream = createReadStream(path)
  stream.on('error', () => res.destroy())
  stream.pipe(res)
}

async function sendThumbnail(req: IncomingMessage, res: ServerResponse, path: string): Promise<void> {
  const thumb = await readFile(path)
    .then((bytes) => sharp(bytes).resize({ width: THUMBNAIL_WIDTH }).jpeg({ quality: 75 }).toBuffer())
    .catch(() => null)
  if (!thumb) return notFound(res)
  res.writeHead(200, { ...BASE_HEADERS, 'Content-Type': 'image/jpeg', 'Content-Length': thumb.length })
  res.end(req.method === 'HEAD' ? undefined : thumb)
}

async function handle(sources: ShareSources, req: IncomingMessage, res: ServerResponse): Promise<void> {
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.writeHead(405, { ...BASE_HEADERS, Allow: 'GET, HEAD' })
    res.end()
    return
  }
  const route = parseShareRoute(req.url ?? '')
  if (!route) return notFound(res)

  if (route.kind === 'page' || route.kind === 'download') {
    const file = sources.registry.get(route.token)
    if (!file) return notFound(res)
    if (route.kind === 'page') return sendHtml(req, res, sharePage(route.token, file.fileName, file.photos.map((photo) => photo.index)))
    const photo = file.photos.find((candidate) => candidate.index === route.index)
    if (!photo) return notFound(res)
    return sendJpeg(req, res, photo.path, file.fileName.replace(/\.jpg$/, `-${route.index}.jpg`))
  }

  // The event gallery: the token names the open event's folder, and only its rounds' originals are served.
  const event = sources.gallery.get(route.token)
  if (!event) return notFound(res)
  if (route.kind === 'gallery') return sendHtml(req, res, galleryPage(route.token, event.name, await listOriginals(event.folder, await listMontages(event.folder))))
  const path = resolveOriginalFile(event.folder, route.fileName, route.index)
  if (!path) return notFound(res)
  return route.kind === 'gallery-file' ? sendJpeg(req, res, path, route.fileName.replace(/\.jpg$/, `-${route.index}.jpg`)) : sendThumbnail(req, res, path)
}

/**
 * The read-only photo server on the event Wi-Fi (DESIGN §17): plain `node:http`, bound to one
 * address, answering only the registry's round tokens and the open event's gallery token. No
 * listing outside the event folder, no upload, and a file name from the URL is only used after it
 * is checked to be a montage name (and a photo number 1 to 3) resolving inside the event folder.
 * Guests only ever get the original photos, never the montage with the template.
 */
export function startShareServer(sources: ShareSources, host: string, port: number): Promise<Server> {
  const server = createServer((req, res) => {
    handle(sources, req, res).catch(() => {
      if (!res.headersSent) notFound(res)
      else res.destroy()
    })
  })
  server.headersTimeout = 10_000
  server.requestTimeout = 30_000
  return new Promise((resolve, reject) => {
    server.once('error', reject)
    server.listen(port, host, () => {
      server.off('error', reject)
      resolve(server)
    })
  })
}

export function stopServer(server: Server): Promise<void> {
  return new Promise((resolve) => {
    server.close(() => resolve())
    server.closeAllConnections()
  })
}
