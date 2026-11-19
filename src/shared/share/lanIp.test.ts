import { describe, expect, it } from 'vitest'
import { pickLanIp } from './lanIp'

const v4 = (address: string, internal = false) => ({ address, family: 'IPv4', internal })

describe('pickLanIp', () => {
  it('prefers the Windows Mobile Hotspot address', () => {
    expect(pickLanIp({ Ethernet: [v4('10.0.0.5')], 'Local Area Connection* 10': [v4('192.168.137.1')] })).toBe('192.168.137.1')
  })

  it('falls back to the first private IPv4, skipping loopback, link-local and IPv6', () => {
    const interfaces = {
      lo: [v4('127.0.0.1', true)],
      apipa: [v4('169.254.10.2')],
      v6: [{ address: 'fe80::1', family: 'IPv6', internal: false }],
      'Wi-Fi': [v4('192.168.0.23')],
    }
    expect(pickLanIp(interfaces)).toBe('192.168.0.23')
  })

  it('accepts the numeric family of older Node versions', () => {
    expect(pickLanIp({ wlan: [{ address: '172.20.1.4', family: 4, internal: false }] })).toBe('172.20.1.4')
  })

  it('returns null with no usable network', () => {
    expect(pickLanIp({ lo: [v4('127.0.0.1', true)], apipa: [v4('169.254.1.1')] })).toBeNull()
  })

  it('uses the operator override as is', () => {
    expect(pickLanIp({ 'Wi-Fi': [v4('192.168.0.23')] }, '192.168.1.10')).toBe('192.168.1.10')
  })
})
