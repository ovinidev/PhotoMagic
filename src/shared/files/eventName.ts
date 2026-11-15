/**
 * The event name is also the folder name on the Desktop (`Desktop\<name>`, DESIGN §9), so it must be
 * a valid Windows folder name. Pure: the create-event screen and main run the same check.
 */

export type EventNameError = 'empty' | 'invalid-character' | 'reserved' | 'trailing-dot-or-space' | 'too-long'

export type EventNameCheck = { ok: true; name: string } | { ok: false; reason: EventNameError }

/** Characters Windows forbids in a file or folder name, plus control characters. */
// oxlint-disable-next-line no-control-regex -- control characters are exactly what this rejects
const INVALID_CHARACTERS = /[\\/:*?"<>|\u0000-\u001f]/

/** `CON`, `PRN`, `AUX`, `NUL`, `COM1`…`COM9`, `LPT1`…`LPT9`, alone or before an extension, any case. */
const RESERVED = /^(con|prn|aux|nul|com[1-9]|lpt[1-9])(\..*)?$/i

/** Keeps `Desktop\<name>\HH-mm-ss-NN.jpg` well under the 260-character Windows path limit. */
export const EVENT_NAME_MAX_LENGTH = 80

/** Trims the name and says whether it can be the event folder. */
export function checkEventName(raw: string): EventNameCheck {
  const name = raw.trim()
  if (name.length === 0) return { ok: false, reason: 'empty' }
  if (name.length > EVENT_NAME_MAX_LENGTH) return { ok: false, reason: 'too-long' }
  if (INVALID_CHARACTERS.test(name)) return { ok: false, reason: 'invalid-character' }
  if (RESERVED.test(name)) return { ok: false, reason: 'reserved' }
  // After trim only a trailing dot can remain; Windows silently drops it, which would rename the folder.
  if (name.endsWith('.')) return { ok: false, reason: 'trailing-dot-or-space' }
  return { ok: true, name }
}
