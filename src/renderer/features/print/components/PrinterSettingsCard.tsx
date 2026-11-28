import { useCallback, useEffect, useId, useState } from 'react'
import { createPortal } from 'react-dom'
import { PRINT_MODES } from '@shared/layout'
import type { PrinterReport, PrinterSettings } from '@shared/printerSettings'
import { Button } from '@renderer/shared/components/ui/button'
import { cn } from '@renderer/shared/utils/cn'
import { PRINTER_SETTINGS_COPY as C, PRINT_COPY } from '../copy'
import { usePrinterStatus } from '../hooks/usePrinterStatus'

type Read = { status: 'idle' } | { status: 'reading' } | { status: 'done'; report: PrinterReport } | { status: 'error' }

function Check({ checked, onChange, label, hint, testId }: { checked: boolean; onChange: (next: boolean) => void; label: string; hint?: string; testId: string }) {
  return (
    <label className="flex min-h-11 cursor-pointer items-start gap-3 text-sm text-ink">
      <input type="checkbox" data-testid={testId} className="mt-0.5 size-5 cursor-pointer accent-ink" checked={checked} onChange={(event) => onChange(event.target.checked)} />
      <span>
        <span className="block font-medium">{label}</span>
        {hint ? <span className="block text-xs text-ink-soft">{hint}</span> : null}
      </span>
    </label>
  )
}

/**
 * Laptop card for the DS-RX1 (DESIGN §10, printer screen): one row on the home page (title, state,
 * `Configurar`) that opens a panel with the 2" cut per mode, whether the app puts the Windows
 * printing preferences back after each print, and `Ler impressora`, a read of the queue and of the
 * preferences Windows has saved for it now, which changes nothing. The page is never rotated or
 * stretched; these settings only choose the cut and what stays in Windows.
 */
export function PrinterSettingsCard() {
  const status = usePrinterStatus()
  const [settings, setSettings] = useState<PrinterSettings | null>(null)
  const [loadError, setLoadError] = useState(false)
  const [open, setOpen] = useState(false)
  const [notice, setNotice] = useState<'saved' | 'error' | null>(null)
  const [read, setRead] = useState<Read>({ status: 'idle' })
  const titleId = useId()

  useEffect(() => {
    let active = true
    window.fotomagica.printer
      .getSettings()
      .then((value) => active && setSettings(value))
      .catch(() => active && setLoadError(true))
    return () => {
      active = false
    }
  }, [])

  useEffect(() => {
    if (!open) return
    const onKey = (event: KeyboardEvent) => event.key === 'Escape' && setOpen(false)
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open])

  const inspect = useCallback(() => {
    setRead({ status: 'reading' })
    window.fotomagica.printer
      .inspect()
      .then((report) => setRead({ status: 'done', report }))
      .catch(() => setRead({ status: 'error' }))
  }, [])

  const save = (next: PrinterSettings) => {
    setSettings(next)
    setNotice(null)
    window.fotomagica.printer
      .saveSettings(next)
      .then((saved) => {
        setSettings(saved)
        setNotice('saved')
      })
      .catch(() => setNotice('error'))
  }

  if (loadError) return <p className="text-sm text-danger">{C.loadError}</p>
  if (!settings) return <p className="text-sm text-ink-soft">{C.loading}</p>

  const line = (
    <p role="status" data-testid="printer-settings-status" className="min-w-0 text-sm text-ink-soft">
      {status ? PRINT_COPY.status[status.kind] : PRINT_COPY.status.checking}
      {' · '}
      {C.summary(settings)}
    </p>
  )

  return (
    <section aria-labelledby="printer-settings-title" data-testid="printer-settings" className="flex min-w-0 items-center justify-between gap-3 border-t border-line pt-4">
      <div className="min-w-0">
        <h2 id="printer-settings-title" className="eyebrow">
          {C.title}
        </h2>
        {open ? null : line}
      </div>
      <Button
        variant="ghost"
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => {
          // Opening the panel reads the printer once, so the saved preferences show right away.
          setOpen(true)
          inspect()
        }}
      >
        {C.open}
      </Button>
      {open
        ? createPortal(
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-6" onClick={(event) => event.target === event.currentTarget && setOpen(false)}>
              <div role="dialog" aria-modal="true" aria-labelledby={titleId} data-testid="printer-settings-panel" className="max-h-full w-full max-w-3xl overflow-y-auto rounded-[var(--radius-card)] border border-line bg-bg-raised px-8 py-6 text-ink">
                <h2 id={titleId} className="font-display text-3xl">
                  {C.title}
                </h2>
                <p className="mt-1 text-sm text-ink-soft">{C.description}</p>

                <fieldset className="mt-5 flex flex-col gap-1">
                  <legend className="eyebrow mb-2">{C.cutLegend}</legend>
                  {PRINT_MODES.map((mode) => (
                    <Check
                      key={mode}
                      testId={`printer-cut-${mode}`}
                      checked={settings.cut[mode]}
                      onChange={(cut) => save({ ...settings, cut: { ...settings.cut, [mode]: cut } })}
                      label={C.cut(mode)}
                      hint={C.cutHint[mode]}
                    />
                  ))}
                </fieldset>

                <fieldset className="mt-4 flex flex-col gap-1">
                  <legend className="eyebrow mb-2">{C.windowsLegend}</legend>
                  <Check
                    testId="printer-restore"
                    checked={settings.restorePreferences}
                    onChange={(restorePreferences) => save({ ...settings, restorePreferences })}
                    label={C.restore}
                    hint={C.restoreHint}
                  />
                </fieldset>

                <div className="mt-5 rounded-[var(--radius-field)] border border-line p-4" data-testid="printer-report">
                  <div className="flex items-center justify-between gap-3">
                    <h3 className="eyebrow">{C.readTitle}</h3>
                    <Button variant="ghost" onClick={inspect} disabled={read.status === 'reading'}>
                      {read.status === 'reading' ? C.reading : C.read}
                    </Button>
                  </div>
                  {read.status === 'done' ? (
                    <dl className="mt-2 grid grid-cols-[max-content_1fr] gap-x-4 gap-y-1 text-sm">
                      <dt className="text-ink-soft">{C.queue}</dt>
                      <dd data-testid="printer-report-queue">{read.report.queue ?? C.noQueue}</dd>
                      <dt className="text-ink-soft">{C.paper}</dt>
                      <dd data-testid="printer-report-paper">{read.report.preferences?.paper ?? '—'}</dd>
                      <dt className="text-ink-soft">{C.orientation}</dt>
                      <dd data-testid="printer-report-orientation">{read.report.preferences?.orientation ?? '—'}</dd>
                      <dt className="text-ink-soft">{C.savedCut}</dt>
                      <dd data-testid="printer-report-cut">{read.report.preferences?.cut ?? '—'}</dd>
                    </dl>
                  ) : null}
                  {read.status === 'done' && read.report.detail ? <p className="mt-2 text-xs text-ink-soft">{PRINT_COPY.technicalDetail(read.report.detail)}</p> : null}
                  {read.status === 'error' ? <p className="mt-2 text-sm text-danger">{C.readError}</p> : null}
                  <p className="mt-2 text-xs text-ink-soft">{C.readHint}</p>
                </div>

                <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                  <p role="status" className={cn('text-sm', notice === 'error' ? 'text-danger' : 'text-ink-soft')} data-testid="printer-settings-notice">
                    {notice === 'saved' ? C.saved : notice === 'error' ? C.saveError : ''}
                  </p>
                  <Button onClick={() => setOpen(false)}>{C.close}</Button>
                </div>
              </div>
            </div>,
            document.body,
          )
        : null}
    </section>
  )
}
