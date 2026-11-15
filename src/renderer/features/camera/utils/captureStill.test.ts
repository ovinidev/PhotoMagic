import { describe, expect, it, vi } from 'vitest'
import { applyMatrix, type Matrix } from '@shared/capture'
import { CAMERA_ROTATION_DEG } from '@shared/constants'
import { captureStill } from './captureStill'
import { drawCameraFrame } from './drawFrame'

function recordingContext() {
  const transforms: Matrix[] = []
  const draws: unknown[][] = []
  return {
    transforms,
    draws,
    setTransform: vi.fn((a: number, b: number, c: number, d: number, e: number, f: number) => {
      transforms.push([a, b, c, d, e, f])
    }),
    drawImage: vi.fn((image: CanvasImageSource, dx: number, dy: number, dw: number, dh: number) => {
      draws.push([image, dx, dy, dw, dh])
    }),
  }
}

function fakeCanvas(jpeg = new Uint8Array([0xff, 0xd8, 0xff])) {
  const context = recordingContext()
  const canvas = {
    width: 0,
    height: 0,
    getContext: () => context,
    toBlob: vi.fn((callback: BlobCallback, _type?: string, _quality?: number) => callback(new Blob([jpeg]))),
  }
  return { canvas, context }
}

const video = { videoWidth: 3840, videoHeight: 2160 } as unknown as HTMLVideoElement

describe('captureStill', () => {
  it('exports the portrait 2160×3840 frame as a quality-95 JPEG', async () => {
    const { canvas } = fakeCanvas()
    const bytes = await captureStill(video, { createCanvas: () => canvas })
    expect(canvas).toMatchObject({ width: 2160, height: 3840 })
    expect(canvas.toBlob).toHaveBeenCalledWith(expect.any(Function), 'image/jpeg', 0.95)
    expect(Array.from(bytes)).toEqual([0xff, 0xd8, 0xff])
  })

  it('draws the frame with the same transform as the preview, only at full size', async () => {
    const { canvas, context } = fakeCanvas()
    await captureStill(video, { createCanvas: () => canvas })
    const still = context.transforms[0]!

    const preview = recordingContext()
    drawCameraFrame(preview, video, { width: 3840, height: 2160 }, CAMERA_ROTATION_DEG, { width: 1080, height: 1920 })
    const onScreen = preview.transforms[0]!

    // The sensor's top-left corner and a point near its left edge land on the same spot, at half scale.
    for (const point of [
      { x: 0, y: 0 },
      { x: 100, y: 1500 },
    ]) {
      const a = applyMatrix(still, point)
      const b = applyMatrix(onScreen, point)
      expect(b.x).toBeCloseTo(a.x / 2)
      expect(b.y).toBeCloseTo(a.y / 2)
    }
    expect(context.draws[0]).toEqual([video, 0, 0, 3840, 2160])
  })

  it('resets the transform after drawing', async () => {
    const { canvas, context } = fakeCanvas()
    await captureStill(video, { createCanvas: () => canvas })
    expect(context.transforms.at(-1)).toEqual([1, 0, 0, 1, 0, 0])
  })

  it('refuses to capture before the first frame', async () => {
    const empty = { videoWidth: 0, videoHeight: 0 } as unknown as HTMLVideoElement
    await expect(captureStill(empty, { createCanvas: () => fakeCanvas().canvas })).rejects.toThrow(/frame/)
  })

  it('fails loudly when encoding fails', async () => {
    const { canvas } = fakeCanvas()
    canvas.toBlob.mockImplementation((callback: BlobCallback) => callback(null))
    await expect(captureStill(video, { createCanvas: () => canvas })).rejects.toThrow(/JPEG/)
  })
})
