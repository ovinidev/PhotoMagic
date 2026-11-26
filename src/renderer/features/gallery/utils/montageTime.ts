/**
 * The time a montage was printed, from its file name (`21-45-08.jpg` → `21:45:08`). A same-second
 * twin (`21-45-08-2.jpg`) reads `21:45:08 (2)`. Any other name is shown as is.
 */
export function montageTime(fileName: string): string {
  const match = /^(\d{2})-(\d{2})-(\d{2})(?:-(\d+))?\.jpe?g$/i.exec(fileName)
  if (!match) return fileName
  const [, hours, minutes, seconds, twin] = match
  const time = `${hours}:${minutes}:${seconds}`
  return twin ? `${time} (${twin})` : time
}
