import { orientedSize } from '@shared/capture'
import { CAMERA_ROTATION_DEG, CAPTURE_JPEG_QUALITY } from '@shared/constants'
import { drawCameraFrame, type FrameContext } from './drawFrame'

export type VideoFrameSource = CanvasImageSource & { videoWidth: number; videoHeight: number }

type CanvasLike = Pick<HTMLCanvasElement, 'width' | 'height' | 'toBlob'> & {
  getContext: (kind: '2d') => FrameContext | null
}

/**
 * The still taken at the shutter: the current video frame, upright and mirrored through
 * `drawCameraFrame` (the same call the preview makes), at full resolution, as a quality-95 JPEG.
 */
export async function captureStill(
  video: VideoFrameSource,
  options: { rotationDeg?: number; createCanvas?: () => CanvasLike } = {},
): Promise<Uint8Array> {
  const { rotationDeg = CAMERA_ROTATION_DEG, createCanvas = () => document.createElement('canvas') } = options
  const source = { width: video.videoWidth, height: video.videoHeight }
  if (source.width === 0 || source.height === 0) throw new Error('The camera has not delivered a frame yet')

  const size = orientedSize(source, rotationDeg)
  const canvas = createCanvas()
  canvas.width = size.width
  canvas.height = size.height
  const context = canvas.getContext('2d')
  if (!context) throw new Error('2D canvas is not available')
  drawCameraFrame(context, video, source, rotationDeg)

  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (result) => (result ? resolve(result) : reject(new Error('JPEG encoding failed'))),
      'image/jpeg',
      CAPTURE_JPEG_QUALITY,
    )
  })
  return new Uint8Array(await blob.arrayBuffer())
}
