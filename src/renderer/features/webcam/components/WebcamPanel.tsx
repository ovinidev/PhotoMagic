import { useEffect, useId, useRef, useState } from 'react'
import type { WebcamState } from '@shared/ipc'
import { WEBCAM_CONTROL_IDS, clampToRange, colorTemperatureApplies, type WebcamValues, type WhiteBalanceMode } from '@shared/webcam'
import { cn } from '@renderer/shared/utils/cn'
import { WEBCAM_COPY } from '../copy'
import { useWebcamState } from '../hooks/useWebcamState'

type Surface = 'tv' | 'laptop'

/** Saving waits for the slider to rest this long, so a drag is one write, not fifty. */
const SAVE_DELAY_MS = 200

function Controls({ state, surface }: { state: WebcamState; surface: Surface }) {
  const id = useId()
  const [draft, setDraft] = useState<WebcamValues | null>(null)
  const [failed, setFailed] = useState(false)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const values = draft ?? state.values
  const capabilities = state.capabilities
  const tv = surface === 'tv'

  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current)
  }, [])

  const change = (next: WebcamValues) => {
    setDraft(next)
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(() => {
      window.fotomagica.webcam
        .set(next)
        .then(() => {
          setFailed(false)
          setDraft(null)
        })
        .catch(() => setFailed(true))
    }, SAVE_DELAY_MS)
  }

  if (!capabilities) return <p className={tv ? 'text-2xl text-white/80' : 'text-sm text-ink-soft'}>{WEBCAM_COPY.noneSaved}</p>
  const shown = WEBCAM_CONTROL_IDS.filter((control) => capabilities.controls[control] && (control !== 'colorTemperature' || colorTemperatureApplies(values, capabilities)))
  if (shown.length === 0 && capabilities.whiteBalanceModes.length === 0) {
    return <p className={tv ? 'text-2xl text-white/80' : 'text-sm text-ink-soft'}>{WEBCAM_COPY.empty}</p>
  }

  const label = tv ? 'text-2xl font-semibold text-white' : 'text-xs font-medium text-ink-soft'
  return (
    <div className={cn('flex flex-col', tv ? 'gap-8' : 'gap-4')}>
      {capabilities.whiteBalanceModes.length > 0 ? (
        <div className="flex flex-col gap-2">
          <label htmlFor={`${id}-wb`} className={label}>
            {WEBCAM_COPY.whiteBalance}
          </label>
          <select
            id={`${id}-wb`}
            value={values.whiteBalanceMode ?? capabilities.whiteBalanceModes[0]}
            onChange={(event) => change({ ...values, whiteBalanceMode: event.target.value as WhiteBalanceMode })}
            className={cn(
              'cursor-pointer',
              tv ? 'min-h-16 rounded-full bg-white/15 px-6 text-2xl text-white' : 'min-h-11 rounded-[var(--radius-field)] border border-line bg-bg-raised px-3 text-sm text-ink',
            )}
          >
            {capabilities.whiteBalanceModes.map((mode) => (
              <option key={mode} value={mode}>
                {WEBCAM_COPY.whiteBalanceModes[mode]}
              </option>
            ))}
          </select>
        </div>
      ) : null}
      {shown.map((control) => {
        const range = capabilities.controls[control]!
        const value = clampToRange(values.controls[control] ?? (range.min + range.max) / 2, range)
        return (
          <div key={control} className="flex flex-col gap-2">
            <div className="flex items-baseline justify-between">
              <label htmlFor={`${id}-${control}`} className={label}>
                {WEBCAM_COPY.controls[control]}
              </label>
              <span className={cn('tabular-nums', tv ? 'text-2xl text-white' : 'text-sm text-ink')}>{value}</span>
            </div>
            <input
              id={`${id}-${control}`}
              type="range"
              min={range.min}
              max={range.max}
              step={range.step}
              value={value}
              onChange={(event) => change({ ...values, controls: { ...values.controls, [control]: Number(event.target.value) } })}
              className={cn('w-full cursor-pointer accent-current', tv ? 'h-16 text-white' : 'h-11 text-ink')}
            />
          </div>
        )
      })}
      {failed ? (
        <p role="alert" className={tv ? 'text-2xl text-white' : 'text-sm text-danger'}>
          {WEBCAM_COPY.saveError}
        </p>
      ) : null}
    </div>
  )
}

/**
 * The webcam adjustments panel (PRD §6.7, RF15). The same panel on the TV (dark glass, 64 px
 * targets) and on the laptop; both write the same state through main. It draws the controls the
 * camera advertises; with no camera open it shows the saved controls and says they apply later.
 */
export function WebcamPanel({ surface }: { surface: Surface }) {
  const view = useWebcamState()
  const tv = surface === 'tv'
  return (
    <div data-testid={`webcam-panel-${surface}`} className="flex flex-col gap-6">
      {view.status === 'loading' ? <p className={tv ? 'text-2xl text-white/80' : 'text-sm text-ink-soft'}>{WEBCAM_COPY.loading}</p> : null}
      {view.status === 'error' ? <p className={tv ? 'text-2xl text-white' : 'text-sm text-danger'}>{WEBCAM_COPY.error}</p> : null}
      {view.status === 'ready' ? (
        <>
          {!view.value.live ? <p className={tv ? 'text-2xl text-white/80' : 'text-sm text-ink-soft'}>{WEBCAM_COPY.offline}</p> : null}
          <Controls state={view.value} surface={surface} />
        </>
      ) : null}
    </div>
  )
}
