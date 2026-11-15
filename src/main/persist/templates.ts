import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { join } from 'node:path'
import sharp, { type Metadata } from 'sharp'
import type { TemplateImportResult, TemplateInfo, Templates } from '@shared/ipc'
import { PRINT_MODES, type PrintMode } from '@shared/layout'
import { checkTemplate } from '@shared/template'
import { TEMPLATES_DIR, readConfig, writeConfig } from './config'

/**
 * Each mode's background (PRD §6.1): a 1844×1240 PNG or JPEG copied into `userData/templates/`, never
 * into the event folder (RF02). Importing for one mode never touches the other.
 */

const THUMBNAIL_WIDTH = 922

async function thumbnail(bytes: Uint8Array): Promise<Buffer> {
  return sharp(bytes).resize({ width: THUMBNAIL_WIDTH }).flatten({ background: '#ffffff' }).jpeg({ quality: 82 }).toBuffer()
}

async function info(mode: PrintMode, fileName: string, bytes: Uint8Array): Promise<TemplateInfo> {
  const meta = await sharp(bytes).metadata()
  return { mode, fileName, width: meta.width, height: meta.height, preview: await thumbnail(bytes) }
}

export async function importTemplate(userData: string, mode: PrintMode, fileName: string, bytes: Uint8Array): Promise<TemplateImportResult> {
  let meta: Metadata
  try {
    meta = await sharp(bytes).metadata()
  } catch {
    return { ok: false, reason: 'unreadable' }
  }
  const check = checkTemplate({ format: meta.format, width: meta.width, height: meta.height })
  if (!check.ok) return check.reason === 'size' ? { ok: false, reason: 'size', width: check.width, height: check.height } : { ok: false, reason: 'format' }

  const file = `${mode}.${meta.format === 'png' ? 'png' : 'jpg'}`
  await mkdir(join(userData, TEMPLATES_DIR), { recursive: true })
  await writeFile(join(userData, TEMPLATES_DIR, file), bytes)
  const config = await readConfig(userData)
  await writeConfig(userData, { ...config, templates: { ...config.templates, [mode]: { file, fileName } } })
  return { ok: true, template: await info(mode, fileName, bytes) }
}

/** The stored template bytes of a mode, or `null` when none was imported or the file is gone. */
export async function readTemplate(userData: string, mode: PrintMode): Promise<{ bytes: Buffer; fileName: string } | null> {
  const ref = (await readConfig(userData)).templates[mode]
  if (!ref) return null
  try {
    return { bytes: await readFile(join(userData, TEMPLATES_DIR, ref.file)), fileName: ref.fileName }
  } catch {
    return null
  }
}

export async function listTemplates(userData: string): Promise<Templates> {
  const entries = await Promise.all(
    PRINT_MODES.map(async (mode) => {
      const stored = await readTemplate(userData, mode)
      try {
        return [mode, stored ? await info(mode, stored.fileName, stored.bytes) : null] as const
      } catch {
        return [mode, null] as const
      }
    }),
  )
  return Object.fromEntries(entries) as Templates
}
