import { useEffect, useState } from 'react'
import QRCode from 'qrcode'

/** A QR code drawn as SVG on the device, no network (DESIGN §15). Black on white with a quiet zone. */
export function QrCode({ text, label, className, testId }: { text: string; label: string; className?: string; testId?: string }) {
  const [svg, setSvg] = useState<string | null>(null)
  useEffect(() => {
    let active = true
    QRCode.toString(text, { type: 'svg', errorCorrectionLevel: 'M', margin: 2 })
      .then((markup) => active && setSvg(markup))
      .catch(() => active && setSvg(null))
    return () => {
      active = false
    }
  }, [text])
  return (
    <div role="img" aria-label={label} data-testid={testId} data-qr-text={text} className={className}>
      {svg ? <img src={`data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`} alt="" className="block h-full w-full rounded-2xl bg-white" draggable={false} /> : null}
    </div>
  )
}
