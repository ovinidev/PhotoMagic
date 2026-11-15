import { useEffect, type RefObject } from 'react'
import { CAMERA_ROTATION_DEG, LAPTOP_PREVIEW } from '@shared/constants'
import { PREVIEW_ACK, listenForPreviewPort } from '@renderer/shared/utils/previewPort'
import { drawCameraFrame } from '../utils/drawFrame'

/** The camera asks for 30 fps (RNF04); there is no point in sending more. */
const FRAME_INTERVAL_MS = 1000 / 30

/**
 * TV side of the live laptop preview (DESIGN §5): every frame, through the same `drawCameraFrame`
 * as the TV and the still, becomes a 360×640 `ImageBitmap` transferred over the `MessageChannel`.
 * A frame is dropped while the laptop has not acknowledged the previous one. Nothing goes through main.
 */
export function usePreviewSender(videoRef: RefObject<HTMLVideoElement | null>, rotationDeg = CAMERA_ROTATION_DEG): void {
  useEffect(() => {
    if (typeof OffscreenCanvas === 'undefined') return
    const canvas = new OffscreenCanvas(LAPTOP_PREVIEW.width, LAPTOP_PREVIEW.height)
    const context = canvas.getContext('2d')
    if (!context) return

    let port: MessagePort | null = null
    let inFlight = false
    let last = 0
    let frame = 0

    const stopListening = listenForPreviewPort((next) => {
      port?.close()
      port = next
      inFlight = false
      next.onmessage = (event) => {
        if (event.data === PREVIEW_ACK) inFlight = false
      }
    })

    const tick = (now: number) => {
      frame = requestAnimationFrame(tick)
      const video = videoRef.current
      if (!port || inFlight || now - last < FRAME_INTERVAL_MS) return
      if (!video || video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA || video.videoWidth === 0) return
      last = now
      drawCameraFrame(context, video, { width: video.videoWidth, height: video.videoHeight }, rotationDeg, LAPTOP_PREVIEW)
      const bitmap = canvas.transferToImageBitmap()
      inFlight = true
      port.postMessage(bitmap, [bitmap])
    }
    frame = requestAnimationFrame(tick)

    return () => {
      cancelAnimationFrame(frame)
      stopListening()
      port?.close()
    }
  }, [videoRef, rotationDeg])
}
