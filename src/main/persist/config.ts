import { mkdir, readFile, rename, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { z } from 'zod'
import { guideBoxListSchema, slotListSchema, webcamCapabilitiesSchema, webcamValuesSchema } from '@shared/ipc'
import { SEED_LAYOUTS, migrateTwoStrips, type GuideBox, type Layouts, type PrintMode, type Slot } from '@shared/layout'
import { NO_WEBCAM_VALUES, type WebcamCapabilities, type WebcamValues } from '@shared/webcam'
import { defaultShareSettings, shareSettingsSchema, type ShareSettings } from '@shared/share'
import { DEFAULT_USER_ZOOM, sanitizeUserZoom } from '@shared/zoom'

/**
 * `userData/config.json` (DESIGN §9): both layouts, both templates and the webcam adjustments. Read with Zod; a missing or
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
  /**
   * The operator's fixed boxes for each mode's current template (DESIGN §6): where every photo is
   * clipped. Missing uses the template's detected dark boxes, else the seed. Importing a new template
   * for a mode clears its entry, so each template keeps its own boxes.
   */
  boxes: Partial<Record<PrintMode, GuideBox[]>>
  /** The operator's webcam values and the controls the camera last advertised (RF15, RNF11). */
  webcam: { values: WebcamValues; capabilities: WebcamCapabilities | null }
  /** The operator's laptop zoom on this computer (DESIGN §3), times the automatic factor. */
  zoom: number
  /** Offline photo download over the event Wi-Fi (DESIGN §17). */
  share: ShareSettings
}

const noWebcam = (): Config['webcam'] => ({ values: { controls: {} }, capabilities: null })

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
  boxes: z
    .object({
      'two-strips': guideBoxListSchema.optional().catch(undefined),
      'one-strip': guideBoxListSchema.optional().catch(undefined),
    })
    .catch(() => ({})),
  webcam: z
    .object({
      values: webcamValuesSchema.catch(() => ({ ...NO_WEBCAM_VALUES, controls: {} })),
      capabilities: webcamCapabilitiesSchema.nullable().catch(null),
    })
    .catch(noWebcam),
  zoom: z.number().optional().catch(undefined),
  share: shareSettingsSchema.catch(defaultShareSettings),
})

export const CONFIG_FILE = 'config.json'
export const TEMPLATES_DIR = 'templates'

export function defaultConfig(): Config {
  return { layouts: { ...SEED_LAYOUTS }, templates: {}, boxes: {}, webcam: noWebcam(), zoom: DEFAULT_USER_ZOOM, share: defaultShareSettings() }
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
  const boxes: Config['boxes'] = {}
  for (const mode of ['two-strips', 'one-strip'] as const) {
    const saved = parsed.data.boxes[mode]
    if (saved && saved.length === SEED_LAYOUTS[mode].length) boxes[mode] = saved
  }
  const layouts: Layouts = { ...parsed.data.layouts, 'two-strips': migrateTwoStrips(parsed.data.layouts['two-strips']) }
  return { layouts, templates, boxes, webcam: parsed.data.webcam as Config['webcam'], zoom: sanitizeUserZoom(parsed.data.zoom), share: parsed.data.share }
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

let queue: Promise<unknown> = Promise.resolve()

/**
 * Reads, changes and writes `config.json`, one change at a time: a template import and a layout save
 * that land together never undo each other. Returns the config as written.
 */
export function updateConfig(userData: string, change: (config: Config) => Config): Promise<Config> {
  const next = queue.then(async () => {
    const updated = change(await readConfig(userData))
    await writeConfig(userData, updated)
    return updated
  })
  queue = next.catch(() => undefined)
  return next
}

/** Writes the webcam adjustments and leaves the layouts and templates as they are (RF15). */
export function saveWebcam(userData: string, webcam: Partial<Config['webcam']>): Promise<Config> {
  return updateConfig(userData, (config) => ({ ...config, webcam: { ...config.webcam, ...webcam } }))
}

/** Writes one mode's layout and leaves the other one, and the templates, as they are (RF03). */
export function saveLayout(userData: string, mode: PrintMode, slots: readonly Slot[]): Promise<Config> {
  return updateConfig(userData, (config) => ({ ...config, layouts: { ...config.layouts, [mode]: [...slots] } }))
}

/** Writes one mode's fixed boxes and leaves everything else as it is (DESIGN §6). */
export function saveBoxes(userData: string, mode: PrintMode, boxes: readonly GuideBox[]): Promise<Config> {
  return updateConfig(userData, (config) => ({ ...config, boxes: { ...config.boxes, [mode]: [...boxes] } }))
}

/** Writes the photo download settings and leaves everything else as it is (DESIGN §17). */
export function saveShare(userData: string, share: ShareSettings): Promise<Config> {
  return updateConfig(userData, (config) => ({ ...config, share }))
}
