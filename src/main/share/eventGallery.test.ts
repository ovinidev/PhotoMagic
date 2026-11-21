import { join, resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { SHARE_TOKEN_PATTERN } from '@shared/share'
import { createEventGallery, resolveEventFile } from './eventGallery'

describe('event gallery token (DESIGN §17)', () => {
  it('maps one random URL-safe token to the open event only', () => {
    const gallery = createEventGallery()
    const event = gallery.open({ name: 'Festa', folder: '/desk/Festa' })
    expect(event.token).toMatch(SHARE_TOKEN_PATTERN)
    expect(gallery.get(event.token)).toEqual({ token: event.token, name: 'Festa', folder: '/desk/Festa' })
    expect(gallery.get('AAAAAAAAAAAAAAAAAAAAAA')).toBeNull()
    // The same event keeps its token; reopening is idempotent.
    expect(gallery.open({ name: 'Festa', folder: '/desk/Festa' }).token).toBe(event.token)
  })

  it('a new event gets a new token and the previous one stops resolving', () => {
    let n = 0
    const gallery = createEventGallery(() => `token${String(n++).padStart(17, '0')}`)
    const first = gallery.open({ name: 'A', folder: '/desk/A' })
    const second = gallery.open({ name: 'B', folder: '/desk/B' })
    expect(second.token).not.toBe(first.token)
    expect(gallery.get(first.token)).toBeNull()
    expect(gallery.get(second.token)?.folder).toBe('/desk/B')
  })

  it('forgets the token when the event ends', () => {
    const gallery = createEventGallery()
    const { token } = gallery.open({ name: 'Festa', folder: '/desk/Festa' })
    gallery.close()
    expect(gallery.get(token)).toBeNull()
    expect(gallery.current()).toBeNull()
    // Reopening the same folder later is a new event: a new token, the old link stays dead.
    expect(gallery.open({ name: 'Festa', folder: '/desk/Festa' }).token).not.toBe(token)
  })
})

describe('resolveEventFile', () => {
  const folder = join('/desk', 'Festa')

  it('resolves a montage name directly inside the event folder', () => {
    expect(resolveEventFile(folder, '21-45-08.jpg')).toBe(resolve(folder, '21-45-08.jpg'))
    expect(resolveEventFile(folder, '21-45-08-2.jpg')).toBe(resolve(folder, '21-45-08-2.jpg'))
  })

  it.each(['../21-45-08.jpg', '../../etc/passwd', '..\\21-45-08.jpg', '/etc/passwd', 'C:\\Windows\\win.ini', 'sub/21-45-08.jpg', '..', '', 'config.json', '21-45-08.jpg/..', '21-45-08.png'])(
    'refuses %j',
    (name) => {
      expect(resolveEventFile(folder, name)).toBeNull()
    },
  )
})
