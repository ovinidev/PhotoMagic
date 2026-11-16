import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import sharp from 'sharp'
import { describe, expect, it } from 'vitest'
import { TWO_STRIPS_CLIENT_BOXES } from '@shared/layout'
import { detectTemplateBoxes } from './detectBoxes'

type Box = { left: number; top: number; width: number; height: number }

/** A white 1844×1240 template with black rounded boxes and some small dark text-like marks. */
async function templateWith(boxes: readonly Box[], radius: number): Promise<Buffer> {
  const rects = boxes.map((b) => `<rect x="${b.left}" y="${b.top}" width="${b.width}" height="${b.height}" rx="${radius}" fill="#000"/>`).join('')
  const noise = '<rect x="1500" y="100" width="60" height="20" fill="#111"/><circle cx="1600" cy="900" r="30" fill="#000"/>'
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1844" height="1240"><rect width="1844" height="1240" fill="#fff"/>${rects}${noise}</svg>`
  return sharp(Buffer.from(svg)).png().toBuffer()
}

describe('detectTemplateBoxes', () => {
  it('finds the client 2 tiras boxes in seed order, 1 px bled, with the corner radius under the measured one', async () => {
    const art = await readFile(resolve(import.meta.dirname, '../../../docs/assets/briefing/template-2-tiras.png')).catch(() => null)
    const template = art ?? (await templateWith(TWO_STRIPS_CLIENT_BOXES, 33))
    const boxes = (await detectTemplateBoxes(template, 'two-strips'))!
    expect(boxes.map((box) => box.id)).toEqual(['top-1', 'top-2', 'top-3', 'bottom-1', 'bottom-2'])
    boxes.forEach((box, index) => {
      const client = TWO_STRIPS_CLIENT_BOXES[index]!
      expect(Math.abs(box.rect.left - (client.left - 1))).toBeLessThanOrEqual(1)
      expect(Math.abs(box.rect.top - (client.top - 1))).toBeLessThanOrEqual(1)
      expect(Math.abs(box.rect.width - (client.width + 2))).toBeLessThanOrEqual(2)
      expect(Math.abs(box.rect.height - (client.height + 2))).toBeLessThanOrEqual(2)
      expect(box.rect.width % 2).toBe(0)
      expect(box.rect.height % 2).toBe(0)
      expect(box.radius).toBeGreaterThanOrEqual(27)
      expect(box.radius).toBeLessThanOrEqual(33)
    })
  })

  it('orders rows top to bottom and each row left to right, whatever the drawing order', async () => {
    const shuffled = [
      { left: 760, top: 690, width: 570, height: 470 },
      { left: 950, top: 80, width: 380, height: 500 },
      { left: 90, top: 690, width: 620, height: 470 },
      { left: 90, top: 80, width: 380, height: 500 },
      { left: 520, top: 80, width: 380, height: 500 },
    ]
    const boxes = (await detectTemplateBoxes(await templateWith(shuffled, 60), 'two-strips'))!
    expect(boxes.map((box) => [box.id, box.rect.left + 1, box.rect.top + 1])).toEqual([
      ['top-1', 90, 80],
      ['top-2', 520, 80],
      ['top-3', 950, 80],
      ['bottom-1', 90, 690],
      ['bottom-2', 760, 690],
    ])
    expect(boxes[0]!.radius).toBeGreaterThanOrEqual(54)
    expect(boxes[0]!.radius).toBeLessThanOrEqual(60)
  })

  it('finds the 3 tall boxes of 1 tira', async () => {
    const tall = [0, 1, 2].map((i) => ({ left: 42 + 600 * i, top: 40, width: 560, height: 1160 }))
    const boxes = (await detectTemplateBoxes(await templateWith(tall, 30), 'one-strip'))!
    expect(boxes.map((box) => box.id)).toEqual(['photo-1', 'photo-2', 'photo-3'])
  })

  it('returns null for a template with no boxes or the wrong number of them', async () => {
    expect(await detectTemplateBoxes(await templateWith([], 0), 'two-strips')).toBeNull()
    expect(await detectTemplateBoxes(await templateWith(TWO_STRIPS_CLIENT_BOXES.slice(0, 3), 33), 'two-strips')).toBeNull()
    expect(await detectTemplateBoxes(await templateWith(TWO_STRIPS_CLIENT_BOXES, 33), 'one-strip')).toBeNull()
  })

  it('ignores a large dark frame line that is not a filled box', async () => {
    const frame = '<rect x="1350" y="50" width="450" height="1100" fill="none" stroke="#000" stroke-width="12"/>'
    const rects = TWO_STRIPS_CLIENT_BOXES.map((b) => `<rect x="${b.left}" y="${b.top}" width="${b.width}" height="${b.height}" rx="33" fill="#000"/>`).join('')
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1844" height="1240"><rect width="1844" height="1240" fill="#fff"/>${rects}${frame}</svg>`
    expect(await detectTemplateBoxes(await sharp(Buffer.from(svg)).png().toBuffer(), 'two-strips')).toHaveLength(5)
  })
})
