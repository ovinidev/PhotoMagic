import type { ShareState } from '@shared/ipc'
import { SHARE_COPY } from '../copy'
import { QrCode } from './QrCode'

function Step({ title, caption, children }: { title: string; caption?: string | undefined; children: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-4">
      <p className="text-3xl font-semibold text-white">{title}</p>
      {children}
      {caption ? <p className="max-w-72 truncate text-2xl text-white/80">{caption}</p> : null}
    </div>
  )
}

/**
 * The TV's two QR codes once the round's montage is saved (DESIGN §17): first join the party
 * Wi-Fi, then open the photo link. Static, no motion. Hidden while there is no link; the Wi-Fi
 * step is left out when the operator set no SSID (guests already on the venue's network).
 */
export function ShareQrPanel({ state }: { state: ShareState | null }) {
  if (!state?.url) return null
  const wifi = state.wifiQr
  return (
    <section data-testid="share-qr" aria-label={SHARE_COPY.panelTitle} className="flex flex-col items-center gap-6">
      <h2 className="text-4xl font-semibold text-white">{SHARE_COPY.panelTitle}</h2>
      <div className="flex items-start justify-center gap-16">
        {wifi ? (
          <Step title={SHARE_COPY.stepWifi} caption={state.ssid}>
            <QrCode text={wifi} label={SHARE_COPY.wifiAlt(state.ssid)} testId="share-qr-wifi" className="size-72" />
          </Step>
        ) : null}
        <Step title={SHARE_COPY.stepScan(wifi ? 2 : 1)} caption={SHARE_COPY.noInternet}>
          <QrCode text={state.url} label={SHARE_COPY.linkAlt} testId="share-qr-link" className="size-72" />
        </Step>
      </div>
    </section>
  )
}
