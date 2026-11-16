import { GLASS } from '@renderer/shared/utils/glass'
import { CLOSE_HOLD_COPY } from '../copy'
import { useCloseHold } from '../hooks/useCloseHold'

const hide = () => void window.fotomagica.display.hideTv().catch(() => {})

/**
 * TV: two fingers held still for 2 s hide the TV window (DESIGN §3). While they are held, a brief
 * pt-BR hint with a filling bar; nothing for one finger or a quick tap. The laptop reopens the TV.
 */
export function CloseHoldLayer() {
  const progress = useCloseHold(hide)
  if (progress === null) return null
  return (
    <div className="pointer-events-none absolute inset-x-0 top-[40%] z-50 flex justify-center px-16" data-testid="close-hold-hint">
      <div role="status" className={`flex w-full max-w-[760px] flex-col items-center gap-6 rounded-[40px] px-12 py-10 text-center text-white ${GLASS}`}>
        <p className="text-[40px] leading-tight font-semibold">{CLOSE_HOLD_COPY.hint}</p>
        <div className="h-3 w-full overflow-hidden rounded-full bg-white/25">
          <div className="h-full rounded-full bg-white" style={{ width: `${Math.round(progress * 100)}%` }} />
        </div>
      </div>
    </div>
  )
}
