/**
 * Name of the montage JPG in the event folder (DESIGN §9): Windows local time, 24 h, hyphens,
 * `21-45-08.jpg`. A second montage in the same second gets `21-45-08-2.jpg`, then `-3`.
 */

const pad = (value: number) => String(value).padStart(2, '0')

/** `HH-mm-ss` from the local clock of `date`. */
export function localTimeStamp(date: Date): string {
  return `${pad(date.getHours())}-${pad(date.getMinutes())}-${pad(date.getSeconds())}`
}

/**
 * The first free name for a montage taken at `date`, given the names already in the folder.
 * The comparison ignores case, as the Windows file system does.
 */
export function montageFileName(date: Date, existing: readonly string[]): string {
  const taken = new Set(existing.map((name) => name.toLowerCase()))
  const stamp = localTimeStamp(date)
  if (!taken.has(`${stamp}.jpg`)) return `${stamp}.jpg`
  for (let suffix = 2; ; suffix++) {
    const candidate = `${stamp}-${suffix}.jpg`
    if (!taken.has(candidate)) return candidate
  }
}

/** True for a name this app writes: `HH-mm-ss.jpg` or `HH-mm-ss-N.jpg`. */
export function isMontageFileName(name: string): boolean {
  const match = /^(\d{2})-(\d{2})-(\d{2})(?:-([2-9]|[1-9]\d+))?\.jpg$/.exec(name)
  if (!match) return false
  const [hours, minutes, seconds] = [match[1], match[2], match[3]].map(Number) as [number, number, number]
  return hours < 24 && minutes < 60 && seconds < 60
}

/**
 * The round's three original captures, as the camera took them, without the template (DESIGN §17):
 * `Originais/21-45-08_1.jpg` … `_3.jpg` next to the montage `21-45-08.jpg`. Guests download these.
 */
export const ORIGINALS_DIR = 'Originais'
export const ORIGINAL_INDEXES = [1, 2, 3] as const
export type OriginalIndex = (typeof ORIGINAL_INDEXES)[number]

export function originalFileName(montage: string, index: OriginalIndex): string {
  return montage.replace(/\.jpg$/, `_${index}.jpg`)
}

export function isOriginalIndex(value: number): value is OriginalIndex {
  return value === 1 || value === 2 || value === 3
}

