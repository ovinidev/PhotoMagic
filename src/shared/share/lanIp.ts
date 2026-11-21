/** One address as `os.networkInterfaces()` lists it; only the fields used here. */
export type InterfaceAddress = { address: string; family: string | number; internal: boolean }

/** The address Windows Mobile Hotspot gives the laptop on its own network. */
export const WINDOWS_HOTSPOT_IP = '192.168.137.1'

const PRIVATE = [/^10\./, /^192\.168\./, /^172\.(1[6-9]|2\d|3[01])\./]

const isIpv4Family = (family: string | number) => family === 'IPv4' || family === 4

/**
 * The laptop's address on the guests' Wi-Fi (DESIGN §17): the operator's override, else the Windows
 * hotspot address when it is up, else the first private IPv4 (a standalone router), else `null`.
 * Loopback and link-local (`169.254.*`, no DHCP) never qualify.
 */
export function pickLanIp(interfaces: Record<string, readonly InterfaceAddress[] | undefined>, override = ''): string | null {
  if (override) return override
  const candidates = Object.values(interfaces)
    .flatMap((list) => list ?? [])
    .filter((entry) => isIpv4Family(entry.family) && !entry.internal)
    .map((entry) => entry.address)
  if (candidates.includes(WINDOWS_HOTSPOT_IP)) return WINDOWS_HOTSPOT_IP
  return candidates.find((address) => PRIVATE.some((pattern) => pattern.test(address))) ?? null
}
