import { mkdir, readFile, rename, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { z } from 'zod'
import { slotListSchema } from '@shared/ipc'
import { SEED_LAYOUTS, type Layouts, type PrintMode } from '@shared/layout'

/**
 * `userData/config.json` (DESIGN §9): both layouts and both templates. Read with Zod; a missing or
 * invalid file falls back to the PRD seeds and no templates, and an invalid part does not erase
 * the others (each layout and each template falls back on its own).
 */

const templateRefSchema = z.strictObject({
  /** File name inside `userData/templates/`. */
  file: z.string().regex(/^(two-strips|one-strip)\.(png|jpg)$/),
  /** The name the operator imported, shown on the create-event screen. */
  fileName: z.string().min(1).max(260),
})

export type TemplateRef = z.infer<typeof templateRefSchema>

export type Config = {
  layouts: Layouts
  templates: Partial<Record<PrintMode, TemplateRef>>
}

const configSchema = z.object({
  layouts: z
    .object({
      'two-strips': slotListSchema.catch(() => [...SEED_LAYOUTS['two-strips']]),
      'one-strip': slotListSchema.catch(() => [...SEED_LAYOUTS['one-strip']]),
    })
    .catch(() => ({ 'two-strips': [...SEED_LAYOUTS['two-strips']], 'one-strip': [...SEED_LAYOUTS['one-strip']] })),
  templates: z
    .object({
      'two-strips': templateRefSchema.optional().catch(undefined),
      'one-strip': templateRefSchema.optional().catch(undefined),
    })
    .catch(() => ({})),
})

export const CONFIG_FILE = 'config.json'
export const TEMPLATES_DIR = 'templates'

export function defaultConfig(): Config {
  return { layouts: { ...SEED_LAYOUTS }, templates: {} }
}

/** Parses whatever is on disk; never throws. */
export function parseConfig(raw: unknown): Config {
  const parsed = configSchema.safeParse(raw ?? {})
  if (!parsed.success) return defaultConfig()
  const templates: Config['templates'] = {}
  for (const mode of ['two-strips', 'one-strip'] as const) {
    const ref = parsed.data.templates[mode]
    if (ref) templates[mode] = ref
  }
  return { layouts: parsed.data.layouts, templates }
}

export async function readConfig(userData: string): Promise<Config> {
  try {
    return parseConfig(JSON.parse(await readFile(join(userData, CONFIG_FILE), 'utf8')))
  } catch {
    return defaultConfig()
  }
}

/** Writes through a temporary file and a rename, so a crash mid-write never leaves half a JSON. */
export async function writeConfig(userData: string, config: Config): Promise<void> {
  const path = join(userData, CONFIG_FILE)
  await mkdir(dirname(path), { recursive: true })
  const temporary = `${path}.tmp`
  await writeFile(temporary, JSON.stringify(config, null, 2))
  await rename(temporary, path)
}
