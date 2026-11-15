import { useEffect, useRef, type RefObject } from 'react'
import { CAMERA_ROTATION_DEG } from '@shared/constants'
import { drawCameraFrame } from '../utils/drawFrame'

/**
 * The live image on the TV: each animation frame draws the video through `drawCameraFrame`
 * (rotated and mirrored, the same call as the still), covering the canvas edge to edge.
 * The `<video>` only decodes; it is never shown. `videoRef` lets the shutter and the laptop preview
 * read the same element.
 */
export function CameraPreview({
  stream,
  videoRef,
  rotationDeg = CAMERA_ROTATION_DEG,
}: {
  stream: MediaStream
  videoRef: RefObject<HTMLVideoElement | null>
  rotationDeg?: number
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const video = videoRef.current
    const canvas = canvasRef.current
    const context = canvas?.getContext('2d')
    if (!video || !canvas || !context) return

    video.srcObject = stream
    // Explicit play, not `autoplay`: Chromium pauses muted autoplay videos it considers off screen.
    video.play().catch(() => {})

    let frame = 0
    const draw = () => {
      frame = requestAnimationFrame(draw)
      if (video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA || video.videoWidth === 0) return
      const ratio = window.devicePixelRatio || 1
      const width = Math.round(canvas.clientWidth * ratio)
      const height = Math.round(canvas.clientHeight * ratio)
      if (width === 0 || height === 0) return
      if (canvas.width !== width) canvas.width = width
      if (canvas.height !== height) canvas.height = height
      drawCameraFrame(context, video, { width: video.videoWidth, height: video.videoHeight }, rotationDeg, { width, height })
    }
    frame = requestAnimationFrame(draw)

    return () => {
      cancelAnimationFrame(frame)
      video.pause()
      video.srcObject = null
    }
  }, [stream, rotationDeg, videoRef])

  return (
    <>
      <video ref={videoRef} muted playsInline className="pointer-events-none absolute size-px opacity-0" aria-hidden />
      <canvas ref={canvasRef} data-testid="camera-preview" className="absolute inset-0 h-full w-full" aria-label="Imagem da câmera" />
    </>
  )
}
