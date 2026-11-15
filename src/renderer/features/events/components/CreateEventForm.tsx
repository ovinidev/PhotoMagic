import { useId, useState } from 'react'
import { checkEventName } from '@shared/files'
import type { EventStartError } from '@shared/ipc'
import { DEFAULT_PRINT_MODE, PRINT_MODES, type PrintMode } from '@shared/layout'
import { TvStatus, useDisplayState } from '@renderer/features/camera'
import { Button } from '@renderer/shared/components/ui/button'
import { cn } from '@renderer/shared/utils/cn'
import { EVENTS_COPY } from '../copy'
import { useTemplates } from '../hooks/useTemplates'
import { TemplatePicker } from './TemplatePicker'

/**
 * Create event (PRD §6.1, RF01, RF02, RF04): name, mode chosen before starting, that mode's template
 * and the TV. `Iniciar evento` stays disabled until all of them are valid; main checks them again,
 * opens the TV and creates or reuses `Desktop\<name>`.
 */
export function CreateEventForm() {
  const nameId = useId()
  const nameHintId = useId()
  const [name, setName] = useState('')
  const [mode, setMode] = useState<PrintMode>(DEFAULT_PRINT_MODE)
  const [allowLandscape, setAllowLandscape] = useState(false)
  const [pending, setPending] = useState(false)
  const [startError, setStartError] = useState<EventStartError | 'failed' | null>(null)
  const [display] = useDisplayState()
  const { templates, imports, importFile } = useTemplates()

  const nameCheck = checkEventName(name)
  const showNameError = !nameCheck.ok && name.length > 0
  const template = templates.status === 'ready' ? templates.value[mode] : null
  const guest = display.status === 'ready' ? display.value.guest.kind : null
  const landscape = guest === 'landscape-external'
  const tvReady = guest === 'portrait' || (landscape && allowLandscape)
  const canStart = nameCheck.ok && template !== null && imports[mode].status === 'idle' && tvReady && !pending
  const modeLabel = EVENTS_COPY.modes[mode].label

  const start = async () => {
    if (!canStart) return
    setPending(true)
    setStartError(null)
    try {
      const result = await window.fotomagica.event.start({ name, mode, allowLandscape })
      // On success main pushes `session:state` and the app moves to the event screen.
      if (!result.ok) setStartError(result.reason)
    } catch {
      setStartError('failed')
    } finally {
      setPending(false)
    }
  }

  return (
    <section aria-labelledby="create-event-title" className="w-full rounded-[var(--radius-card)] border border-line bg-bg-raised p-8">
      <h1 id="create-event-title" className="text-2xl font-semibold text-ink">
        {EVENTS_COPY.title}
      </h1>
      <form
        className="mt-8 flex flex-col gap-8"
        onSubmit={(event) => {
          event.preventDefault()
          void start()
        }}
      >
        <div className="flex flex-col gap-2">
          <label htmlFor={nameId} className="text-sm font-medium text-ink">
            {EVENTS_COPY.name}
          </label>
          <input
            id={nameId}
            value={name}
            maxLength={200}
            autoComplete="off"
            placeholder={EVENTS_COPY.namePlaceholder}
            aria-invalid={showNameError}
            aria-describedby={nameHintId}
            onChange={(event) => setName(event.target.value)}
            className={cn(
              'min-h-11 rounded-[var(--radius-field)] border bg-bg-raised px-3 text-ink placeholder:text-ink-soft/60',
              'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink',
              showNameError ? 'border-danger' : 'border-line',
            )}
          />
          <p id={nameHintId} className={cn('text-sm', showNameError ? 'text-danger' : 'text-ink-soft')}>
            {!nameCheck.ok ? (showNameError ? EVENTS_COPY.nameErrors[nameCheck.reason] : EVENTS_COPY.folderHintEmpty) : EVENTS_COPY.folderHint(nameCheck.name)}
          </p>
        </div>

        <fieldset>
          <legend className="mb-2 text-sm font-medium text-ink">{EVENTS_COPY.mode}</legend>
          <div className="grid grid-cols-2 gap-3">
            {PRINT_MODES.map((option) => (
              <label
                key={option}
                className={cn(
                  'flex min-h-11 cursor-pointer items-start gap-3 rounded-[var(--radius-field)] border p-4',
                  'focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-ink',
                  mode === option ? 'border-ink bg-bg' : 'border-line',
                )}
              >
                <input
                  type="radio"
                  name="mode"
                  value={option}
                  checked={mode === option}
                  onChange={() => setMode(option)}
                  className="mt-1 size-4 cursor-pointer accent-ink"
                />
                <span>
                  <span className="block font-medium text-ink">{EVENTS_COPY.modes[option].label}</span>
                  <span className="block text-sm text-ink-soft">{EVENTS_COPY.modes[option].detail}</span>
                </span>
              </label>
            ))}
          </div>
        </fieldset>

        <TemplatePicker
          key={mode}
          modeLabel={modeLabel}
          templates={templates}
          template={template}
          importState={imports[mode]}
          onFile={(file) => void importFile(mode, file)}
        />

        <div className="flex flex-col gap-3 border-t border-line pt-6">
          <h2 className="text-sm font-medium text-ink">{EVENTS_COPY.tv}</h2>
          <TvStatus view={display} />
          {landscape ? (
            <label className="flex min-h-11 cursor-pointer items-center gap-3 text-sm text-ink">
              <input
                type="checkbox"
                checked={allowLandscape}
                onChange={(event) => setAllowLandscape(event.target.checked)}
                className="size-5 cursor-pointer accent-ink"
              />
              {EVENTS_COPY.landscapeConfirm}
            </label>
          ) : null}
        </div>

        {startError ? (
          <p role="alert" className="text-sm text-danger">
            {startError === 'failed' ? EVENTS_COPY.startFailed : EVENTS_COPY.startErrors[startError]}
          </p>
        ) : null}

        <div className="flex justify-end">
          <Button type="submit" disabled={!canStart}>
            {pending ? EVENTS_COPY.starting : EVENTS_COPY.start}
          </Button>
        </div>
      </form>
    </section>
  )
}
