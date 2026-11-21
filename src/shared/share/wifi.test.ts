import { describe, expect, it } from 'vitest'
import { escapeWifiField, wifiQrText } from './wifi'

describe('escapeWifiField', () => {
  it('escapes ; , : \\ and " with a backslash', () => {
    expect(escapeWifiField(String.raw`a;b,c:d\e"f`)).toBe(String.raw`a\;b\,c\:d\\e\"f`)
  })

  it('leaves other characters, accents included, as they are', () => {
    expect(escapeWifiField('Foto Mágica 2.0!')).toBe('Foto Mágica 2.0!')
  })
})

describe('wifiQrText', () => {
  it('builds the WPA join string', () => {
    expect(wifiQrText({ ssid: 'FotoMagica', password: 'festa2026', security: 'WPA' })).toBe('WIFI:T:WPA;S:FotoMagica;P:festa2026;;')
  })

  it('escapes the SSID and the password', () => {
    expect(wifiQrText({ ssid: 'Festa;Ana', password: 'p:a,s"s\\', security: 'WPA' })).toBe(String.raw`WIFI:T:WPA;S:Festa\;Ana;P:p\:a\,s\"s\\;;`)
  })

  it('drops the password of an open network and marks a hidden one', () => {
    expect(wifiQrText({ ssid: 'Aberta', password: 'ignored', security: 'nopass', hidden: true })).toBe('WIFI:T:nopass;S:Aberta;H:true;;')
  })
})
