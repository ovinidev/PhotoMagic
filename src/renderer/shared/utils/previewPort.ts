import { PREVIEW_PORT_MESSAGE } from '@shared/ipc'

/**
 * Receives the live-preview `MessagePort` the preload re-posts to the page (DESIGN §5) and asks main
 * for a fresh channel. Each new port replaces the previous one; the caller closes the old port.
 * Returns the cleanup.
 */
export function listenForPreviewPort(onPort: (port: MessagePort) => void): () => void {
  const handler = (event: MessageEvent) => {
    if (event.source !== window || event.data !== PREVIEW_PORT_MESSAGE) return
    const [port] = event.ports
    if (port) onPort(port)
  }
  window.addEventListener('message', handler)
  window.fotomagica.camera.requestPreviewPort()
  return () => window.removeEventListener('message', handler)
}

/** Message the laptop answers after drawing a frame, so the TV sends the next one (RNF04). */
export const PREVIEW_ACK = 'ack'
