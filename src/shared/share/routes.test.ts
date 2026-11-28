import { describe, expect, it } from 'vitest'
import { galleryPageUrl, parseShareRoute, sharePageUrl } from './routes'

const token = 'AbCdEfGhIjKlMnOpQrStUv'

describe('parseShareRoute', () => {
  it('maps the page and the download of a well-formed token', () => {
    expect(parseShareRoute(`/p/${token}`)).toEqual({ kind: 'page', token })
    expect(parseShareRoute(`/p/${token}?x=1`)).toEqual({ kind: 'page', token })
    expect(parseShareRoute(`/p/${token}/foto-1.jpg`)).toEqual({ kind: 'download', token, index: 1 })
    expect(parseShareRoute(`/p/${token}/foto-3.jpg`)).toEqual({ kind: 'download', token, index: 3 })
  })

  it.each([
    '/',
    '/p',
    '/p/',
    `/p/${token}/`,
    `/p/${token}/../../config.json`,
    `/p/../${token}`,
    `/p/${token}/..%2F..%2Fconfig.json`,
    `/p/${token}%2F..`,
    '/p/..%2F..%2FWindows',
    '/p/short',
    `/p/${token}x`,
    `//p/${token}`,
    `/P/${token}`,
    `/p/${token}/other.jpg`,
    `/p/${token}/foto-1.jpg/x`,
    `/p/${token}/foto.jpg`,
    `/p/${token}/foto-4.jpg`,
    `/p/${token}/foto-0.jpg`,
    `/p/${token}/foto-01.jpg`,
    `http://evil/p/${token}`,
    '/p/AbCdEfGhIjKlMnOpQrSt.v',
  ])('refuses %s', (url) => {
    expect(parseShareRoute(url)).toBeNull()
  })
})

describe('parseShareRoute, event gallery', () => {
  it('maps the gallery, and a thumbnail and a download of one original of a round', () => {
    expect(parseShareRoute(`/e/${token}`)).toEqual({ kind: 'gallery', token })
    expect(parseShareRoute(`/e/${token}/t/21-45-08.jpg/1`)).toEqual({ kind: 'gallery-thumb', token, fileName: '21-45-08.jpg', index: 1 })
    expect(parseShareRoute(`/e/${token}/f/21-45-08-2.jpg/3`)).toEqual({ kind: 'gallery-file', token, fileName: '21-45-08-2.jpg', index: 3 })
  })

  it.each([
    '/e',
    '/e/',
    `/e/${token}/`,
    `/e/${token}/f`,
    `/e/${token}/f/`,
    `/e/${token}/f/../../config.json`,
    `/e/${token}/f/..%2F..%2Fconfig.json`,
    `/e/${token}/f/%2e%2e%2f21-45-08.jpg`,
    `/e/${token}/f/secret.txt`,
    `/e/${token}/f/25-00-00.jpg`,
    `/e/${token}/x/21-45-08.jpg`,
    `/e/${token}/f/21-45-08.jpg/x`,
    `/e/${token}/f/21-45-08.jpg`,
    `/e/${token}/f/21-45-08.jpg/4`,
    `/e/${token}/f/21-45-08.jpg/1/x`,
    `/e/${token}/f/21-45-08_1.jpg/1`,
    `/e/${token}/foto.jpg`,
    `/e/short`,
  ])('refuses %s', (url) => {
    expect(parseShareRoute(url)).toBeNull()
  })
})

describe('galleryPageUrl', () => {
  it('builds the link of the operator QR code', () => {
    expect(galleryPageUrl('192.168.137.1', 8787, token)).toBe(`http://192.168.137.1:8787/e/${token}`)
  })
})

describe('sharePageUrl', () => {
  it('builds the link of the QR code', () => {
    expect(sharePageUrl('192.168.137.1', 8787, token)).toBe(`http://192.168.137.1:8787/p/${token}`)
  })
})
