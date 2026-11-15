import { writeFileSync } from 'node:fs'

type Rgb = readonly [number, number, number]
type Region = { x: number; y: number; width: number; height: number; color: Rgb }

/** BT.601 full-range RGB → YCbCr, the `C420jpeg` colorspace Chromium reads. */
function toYuv([r, g, b]: Rgb): [number, number, number] {
  const clamp = (value: number) => Math.max(0, Math.min(255, Math.round(value)))
  return [
    clamp(0.299 * r + 0.587 * g + 0.114 * b),
    clamp(128 - 0.168736 * r - 0.331264 * g + 0.5 * b),
    clamp(128 + 0.5 * r - 0.418688 * g - 0.081312 * b),
  ]
}

/**
 * Writes a one-frame `.y4m` that Chromium's fake camera loops (`--use-file-for-fake-video-capture`).
 * Later regions paint over earlier ones. Keep coordinates even: chroma is subsampled 2×2.
 */
export function writeY4m(path: string, size: { width: number; height: number }, background: Rgb, regions: Region[]): void {
  const { width, height } = size
  const colorAt = (x: number, y: number): Rgb => {
    let color = background
    for (const region of regions) {
      if (x >= region.x && x < region.x + region.width && y >= region.y && y < region.y + region.height) color = region.color
    }
    return color
  }
  const yPlane = Buffer.alloc(width * height)
  const uPlane = Buffer.alloc((width / 2) * (height / 2))
  const vPlane = Buffer.alloc((width / 2) * (height / 2))
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const [luma, cb, cr] = toYuv(colorAt(x, y))
      yPlane[y * width + x] = luma
      if (x % 2 === 0 && y % 2 === 0) {
        const index = (y / 2) * (width / 2) + x / 2
        uPlane[index] = cb
        vPlane[index] = cr
      }
    }
  }
  const header = Buffer.from(`YUV4MPEG2 W${width} H${height} F30:1 Ip A1:1 C420jpeg\nFRAME\n`, 'ascii')
  writeFileSync(path, Buffer.concat([header, yPlane, uPlane, vPlane]))
}
