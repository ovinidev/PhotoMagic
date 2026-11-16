import sharp from 'sharp'
import { SHEET } from '@shared/constants'
import { SEED_LAYOUTS, type GuideBox, type PrintMode } from '@shared/layout'

/** A pixel darker than this (0–255 luminance) belongs to a box; the anti-aliased half of the edge counts. */
const DARK_LUMINANCE = 128
/** Regions smaller than this share of the sheet are text or ornaments, not photo boxes. */
const MIN_AREA_SHARE = 0.01
/** A rounded rectangle fills nearly all of its bounding box; a blob or a frame line does not. */
const MIN_FILL = 0.9
/** Pixels the box grows on each side, so the photo covers the anti-aliased rim of the black. */
const BLEED = 1
/** Pixels taken off the measured corner radius, so the photo's corner lies over the black one. */
const RADIUS_MARGIN = 2

/**
 * The near-black rounded rectangles of a template (DESIGN §6): the art's own photo boxes, in seed
 * order (rows top to bottom, each left to right), with their position, size and approximate corner
 * radius. `null` when the template has none, or not exactly one per slot of the mode's seed: the
 * seed boxes are used then. Simple threshold plus 4-connected regions; small regions are ignored.
 */
export async function detectTemplateBoxes(template: Uint8Array, mode: PrintMode): Promise<GuideBox[] | null> {
  const { width, height } = SHEET
  const gray = await sharp(template)
    .resize(width, height, { fit: 'fill' })
    .flatten({ background: '#ffffff' })
    .greyscale()
    .raw()
    .toBuffer()
  const seen = new Uint8Array(width * height)
  const stack = new Int32Array(width * height)
  const found: { left: number; top: number; right: number; bottom: number; area: number }[] = []

  for (let start = 0; start < gray.length; start++) {
    if (seen[start] || gray[start]! >= DARK_LUMINANCE) continue
    seen[start] = 1
    let size = 0
    stack[size++] = start
    const region = { left: width as number, top: height as number, right: -1, bottom: -1, area: 0 }
    while (size > 0) {
      const at = stack[--size]!
      const x = at % width
      const y = (at - x) / width
      region.area++
      if (x < region.left) region.left = x
      if (x > region.right) region.right = x
      if (y < region.top) region.top = y
      if (y > region.bottom) region.bottom = y
      for (const next of [x > 0 ? at - 1 : -1, x < width - 1 ? at + 1 : -1, y > 0 ? at - width : -1, y < height - 1 ? at + width : -1]) {
        if (next < 0 || seen[next] || gray[next]! >= DARK_LUMINANCE) continue
        seen[next] = 1
        stack[size++] = next
      }
    }
    found.push(region)
  }

  const boxes = found
    .map((r) => ({ ...r, width: r.right - r.left + 1, height: r.bottom - r.top + 1 }))
    .filter((r) => r.area >= MIN_AREA_SHARE * width * height && r.area >= MIN_FILL * r.width * r.height)
    .map(toBox)
  if (boxes.length !== SEED_LAYOUTS[mode].length) return null
  return inSeedOrder(boxes).map((box, index) => ({ ...box, id: SEED_LAYOUTS[mode][index]!.id }))
}

/**
 * One region as a box. The corners a radius r cuts off a rectangle add up to (4 − π)·r², so the
 * missing area gives the radius. The size is made even so a quarter-turned slot on it stays on whole pixels.
 */
function toBox(r: { left: number; top: number; width: number; height: number; area: number }): GuideBox {
  const missing = Math.max(0, r.width * r.height - r.area)
  const measured = Math.sqrt(missing / (4 - Math.PI))
  const width = r.width + 2 * BLEED + (r.width % 2)
  const height = r.height + 2 * BLEED + (r.height % 2)
  const radius = Math.max(0, Math.round(measured) - RADIUS_MARGIN)
  return { id: '', rect: { left: r.left - BLEED, top: r.top - BLEED, width, height }, radius }
}

/** Rows top to bottom (a box whose center is below the row's tallest box starts a new row), each left to right. */
function inSeedOrder(boxes: GuideBox[]): GuideBox[] {
  const byTop = [...boxes].sort((a, b) => a.rect.top - b.rect.top)
  const rows: GuideBox[][] = []
  for (const box of byTop) {
    const row = rows.at(-1)
    const centerY = box.rect.top + box.rect.height / 2
    if (row && centerY < Math.max(...row.map((other) => other.rect.top + other.rect.height))) row.push(box)
    else rows.push([box])
  }
  return rows.flatMap((row) => row.sort((a, b) => a.rect.left - b.rect.left))
}
