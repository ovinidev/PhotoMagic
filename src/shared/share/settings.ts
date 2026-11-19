import { z } from 'zod'

/**
 * Offline photo download over the event's own Wi-Fi (DESIGN §15): the operator's settings, kept in
 * `config.json`. No internet and no cloud: the laptop serves the montage on the local network.
 */

export const WIFI_SECURITIES = ['WPA', 'WEP', 'nopass'] as const
export type WifiSecurity = (typeof WIFI_SECURITIES)[number]

export const DEFAULT_SHARE_PORT = 8787

const ipv4 = /^(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3}$/

export const shareSettingsSchema = z.strictObject({
  enabled: z.boolean(),
  port: z.number().int().min(1024).max(65535),
  /** The laptop's address on the guests' Wi-Fi; empty picks it automatically. */
  hostOverride: z.union([z.literal(''), z.string().regex(ipv4)]),
  wifi: z.strictObject({
    ssid: z.string().max(32),
    password: z.string().max(63),
    security: z.enum(WIFI_SECURITIES),
    hidden: z.boolean(),
  }),
})

export type ShareSettings = z.infer<typeof shareSettingsSchema>

export function defaultShareSettings(): ShareSettings {
  return { enabled: false, port: DEFAULT_SHARE_PORT, hostOverride: '', wifi: { ssid: '', password: '', security: 'WPA', hidden: false } }
}

export function isIpv4(value: string): boolean {
  return ipv4.test(value)
}
