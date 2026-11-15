import { SHEET } from './constants'

/**
 * The template the operator imports per mode (PRD §6.1, RF01): a PNG or JPEG of exactly 1844×1240.
 * Pure: main runs it on the decoded file, the test lists the cases.
 */

export const TEMPLATE_FORMATS = ['png', 'jpeg'] as const

export type TemplateRejection = { reason: 'format' } | { reason: 'size'; width: number; height: number }

export type TemplateCheck = { ok: true } | ({ ok: false } & TemplateRejection)

export function checkTemplate(image: { format: string | undefined; width: number; height: number }): TemplateCheck {
  if (!TEMPLATE_FORMATS.some((format) => format === image.format)) return { ok: false, reason: 'format' }
  if (image.width !== SHEET.width || image.height !== SHEET.height) {
    return { ok: false, reason: 'size', width: image.width, height: image.height }
  }
  return { ok: true }
}
