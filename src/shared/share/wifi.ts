import type { WifiSecurity } from './settings'

/**
 * The Wi-Fi join string phones read from a QR code (the ZXing `WIFI:` format):
 * `WIFI:T:WPA;S:<ssid>;P:<password>;;`. In the SSID and the password, `\`, `;`, `,`, `:` and `"`
 * are escaped with a backslash, otherwise a password with `;` ends the field early.
 */
export function escapeWifiField(value: string): string {
  return value.replace(/[\\;,:"]/g, (char) => `\\${char}`)
}

export function wifiQrText(wifi: { ssid: string; password: string; security: WifiSecurity; hidden?: boolean }): string {
  const parts = [`T:${wifi.security}`, `S:${escapeWifiField(wifi.ssid)}`]
  if (wifi.security !== 'nopass') parts.push(`P:${escapeWifiField(wifi.password)}`)
  if (wifi.hidden) parts.push('H:true')
  return `WIFI:${parts.join(';')};;`
}
