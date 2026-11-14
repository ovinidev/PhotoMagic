import { describe, expect, it } from 'vitest'
import { SECURE_WEB_PREFERENCES } from './rendererEntry'

describe('SECURE_WEB_PREFERENCES', () => {
  it('isolates both windows from Node (CLAUDE.md conventions)', () => {
    expect(SECURE_WEB_PREFERENCES).toMatchObject({
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true,
    })
    expect(SECURE_WEB_PREFERENCES.preload).toMatch(/preload[\\/]index\.js$/)
  })
})
