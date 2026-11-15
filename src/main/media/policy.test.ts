import { describe, expect, it } from 'vitest'
import { allowPermission, cameraFixtureSwitches } from './policy'

describe('allowPermission', () => {
  it('lets the TV window open the camera', () => {
    expect(allowPermission({ permission: 'media', fromGuestWindow: true, mediaTypes: ['video'] })).toBe(true)
    // Permission checks (enumerateDevices labels) carry no media types.
    expect(allowPermission({ permission: 'media', fromGuestWindow: true })).toBe(true)
  })

  it('denies the microphone: the booth has no audio', () => {
    expect(allowPermission({ permission: 'media', fromGuestWindow: true, mediaTypes: ['video', 'audio'] })).toBe(false)
  })

  it('denies the camera to the laptop window', () => {
    expect(allowPermission({ permission: 'media', fromGuestWindow: false, mediaTypes: ['video'] })).toBe(false)
  })

  it('denies every other permission', () => {
    for (const permission of ['geolocation', 'notifications', 'clipboard-read', 'display-capture']) {
      expect(allowPermission({ permission, fromGuestWindow: true })).toBe(false)
    }
  })
})

describe('cameraFixtureSwitches', () => {
  it('uses a fake device, a fake file, or zero devices', () => {
    expect(cameraFixtureSwitches({ kind: 'pattern' })).toEqual([['use-fake-device-for-media-stream']])
    expect(cameraFixtureSwitches({ kind: 'none' })).toEqual([['use-fake-device-for-media-stream', 'device-count=0']])
    expect(cameraFixtureSwitches({ kind: 'file', path: '/tmp/MX Brio fixture.y4m' })).toEqual([
      ['use-fake-device-for-media-stream'],
      ['use-file-for-fake-video-capture', '/tmp/MX Brio fixture.y4m'],
    ])
  })
})
