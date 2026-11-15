import { describe, expect, it } from 'vitest'
import { EVENT_NAME_MAX_LENGTH, checkEventName } from './eventName'

describe('checkEventName', () => {
  it('accepts a name with accents and spaces, trimmed', () => {
    expect(checkEventName('  Aniversário AJ  ')).toEqual({ ok: true, name: 'Aniversário AJ' })
  })

  it.each(['', '   ', '\t'])('rejects an empty or blank name (%j)', (name) => {
    expect(checkEventName(name)).toEqual({ ok: false, reason: 'empty' })
  })

  it.each(['a\\b', 'a/b', 'a:b', 'a*b', 'a?b', 'a"b', 'a<b', 'a>b', 'a|b', 'a\u0007b'])(
    'rejects a name with a character Windows forbids (%j)',
    (name) => {
      expect(checkEventName(name)).toEqual({ ok: false, reason: 'invalid-character' })
    },
  )

  it.each(['CON', 'prn', 'Aux', 'NUL', 'COM1', 'com9', 'LPT1', 'lpt9', 'con.txt', ' NUL '])(
    'rejects the reserved Windows name %j',
    (name) => {
      expect(checkEventName(name)).toEqual({ ok: false, reason: 'reserved' })
    },
  )

  it.each(['COM0', 'LPT10', 'Console', 'Nulo'])('accepts %j, which only looks like a reserved name', (name) => {
    expect(checkEventName(name).ok).toBe(true)
  })

  it('rejects a trailing dot, which Windows would drop from the folder', () => {
    expect(checkEventName('Festa.')).toEqual({ ok: false, reason: 'trailing-dot-or-space' })
  })

  it('rejects a name longer than the limit', () => {
    expect(checkEventName('a'.repeat(EVENT_NAME_MAX_LENGTH)).ok).toBe(true)
    expect(checkEventName('a'.repeat(EVENT_NAME_MAX_LENGTH + 1))).toEqual({ ok: false, reason: 'too-long' })
  })
})
