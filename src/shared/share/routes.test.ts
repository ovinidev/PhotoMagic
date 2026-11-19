import { describe, expect, it } from 'vitest'
import { parseShareRoute, sharePageUrl } from './routes'

const token = 'AbCdEfGhIjKlMnOpQrStUv'

describe('parseShareRoute', () => {
  it('maps the page and the download of a well-formed token', () => {
    expect(parseShareRoute(`/p/${token}`)).toEqual({ kind: 'page', token })
    expect(parseShareRoute(`/p/${token}?x=1`)).toEqual({ kind: 'page', token })
    expect(parseShareRoute(`/p/${token}/foto.jpg`)).toEqual({ kind: 'download', token })
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
    `/p/${token}/foto.jpg/x`,
    `http://evil/p/${token}`,
    '/p/AbCdEfGhIjKlMnOpQrSt.v',
  ])('refuses %s', (url) => {
    expect(parseShareRoute(url)).toBeNull()
  })
})

describe('sharePageUrl', () => {
  it('builds the link of the QR code', () => {
    expect(sharePageUrl('192.168.137.1', 8787, token)).toBe(`http://192.168.137.1:8787/p/${token}`)
  })
})
