import { createReadStream } from 'node:fs'
import { stat } from 'node:fs/promises'
import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http'
import { parseShareRoute } from '@shared/share'
import { sharePage } from './page'
import type { ShareRegistry } from './registry'

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

async function handle(registry: ShareRegistry, req: IncomingMessage, res: ServerResponse): Promise<void> {
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.writeHead(405, { ...BASE_HEADERS, Allow: 'GET, HEAD' })
    res.end()
    return
  }
  const route = parseShareRoute(req.url ?? '')
  const file = route ? registry.get(route.token) : null
  if (!route || !file) return notFound(res)

  if (route.kind === 'page') {
    const body = sharePage(route.token, file.fileName)
    res.writeHead(200, {
      ...BASE_HEADERS,
      'Content-Type': 'text/html; charset=utf-8',
      'Content-Length': Buffer.byteLength(body),
      'Content-Security-Policy': "default-src 'none'; img-src 'self'; style-src 'unsafe-inline'",
    })
    res.end(req.method === 'HEAD' ? undefined : body)
    return
  }

  const info = await stat(file.path).catch(() => null)
  if (!info?.isFile()) return notFound(res)
  res.writeHead(200, {
    ...BASE_HEADERS,
    'Content-Type': 'image/jpeg',
    'Content-Length': info.size,
    'Content-Disposition': `inline; filename="foto-magica-${file.fileName.replace(/[^\w.-]/g, '')}"`,
  })
  if (req.method === 'HEAD') {
    res.end()
    return
  }
  const stream = createReadStream(file.path)
  stream.on('error', () => res.destroy())
  stream.pipe(res)
}

/**
 * The read-only photo server on the event Wi-Fi (DESIGN §17): plain `node:http`, bound to one
 * address, answering only the registry's tokens. No listing, no upload, no path from the URL.
 */
export function startShareServer(registry: ShareRegistry, host: string, port: number): Promise<Server> {
  const server = createServer((req, res) => {
    handle(registry, req, res).catch(() => {
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
