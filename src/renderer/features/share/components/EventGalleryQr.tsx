import type { ShareState } from '@shared/ipc'
import { SHARE_COPY } from '../copy'
import { QrCode } from './QrCode'

/**
 * The laptop's footer during an event (DESIGN §17): the event gallery QR, and the Wi-Fi join QR
 * beside it when the operator set an SSID. Only while the local server runs and an event is open;
 * the gallery link dies with `Encerrar evento`. Compact so 1280×800 keeps no vertical scroll.
 */
export function EventGalleryQr({ state }: { state: ShareState | null }) {
  if (!state?.galleryUrl) return null
  const copy = SHARE_COPY.gallery
  return (
    <footer data-testid="event-gallery-qr" aria-label={copy.title} className="flex shrink-0 items-center justify-center gap-10 border-t border-line bg-bg-raised px-6 py-2">
      <div className="flex items-center gap-3">
        <QrCode text={state.galleryUrl} label={copy.alt} testId="event-gallery-qr-link" className="size-24 shrink-0" />
        <div className="flex max-w-64 flex-col gap-1">
          <p className="text-[15px] font-semibold text-ink">{copy.title}</p>
          <p className="text-[13px] text-ink-soft">{copy.caption}</p>
        </div>
      </div>
      {state.wifiQr ? (
        <div className="flex items-center gap-3">
          <QrCode text={state.wifiQr} label={copy.wifiAlt(state.ssid)} testId="event-gallery-qr-wifi" className="size-24 shrink-0" />
          <div className="flex max-w-48 flex-col gap-1">
            <p className="text-[15px] font-semibold text-ink">{copy.wifiTitle}</p>
            <p className="text-[13px] break-words text-ink-soft">{state.ssid}</p>
          </div>
        </div>
      ) : null}
    </footer>
  )
}
