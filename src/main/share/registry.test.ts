import { describe, expect, it } from 'vitest'
import { SHARE_TOKEN_PATTERN } from '@shared/share'
import { createShareRegistry } from './registry'

describe('share registry', () => {
  it('hands out URL-safe 128-bit tokens that map only to the registered file', () => {
    const registry = createShareRegistry()
    const token = registry.add({ path: 'C:\\Users\\op\\Desktop\\Festa\\21-45-08.jpg', fileName: '21-45-08.jpg' })
    expect(token).toMatch(SHARE_TOKEN_PATTERN)
    expect(registry.get(token)?.fileName).toBe('21-45-08.jpg')
    expect(registry.get('AAAAAAAAAAAAAAAAAAAAAA')).toBeNull()
    expect(registry.get('../21-45-08.jpg')).toBeNull()
  })

  it('drops the oldest entry past the cap and forgets everything on clear', () => {
    const registry = createShareRegistry(2)
    const first = registry.add({ path: 'a', fileName: 'a.jpg' })
    registry.add({ path: 'b', fileName: 'b.jpg' })
    registry.add({ path: 'c', fileName: 'c.jpg' })
    expect(registry.get(first)).toBeNull()
    expect(registry.size).toBe(2)
    registry.clear()
    expect(registry.size).toBe(0)
  })
})
