import { useEffect, useId, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { WIFI_SECURITIES, shareSettingsSchema, type ShareSettings } from '@shared/share'
import { Button } from '@renderer/shared/components/ui/button'
import { cn } from '@renderer/shared/utils/cn'
import { SHARE_COPY } from '../copy'
import { useShareState } from '../hooks/useShareState'

const C = SHARE_COPY.settings
const FIELD = cn(
  'min-h-11 w-full rounded-[var(--radius-field)] border border-line bg-bg-raised px-3 text-sm text-ink',
  'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink disabled:opacity-50',
)

function Field({ label, hint, children }: { label: string; hint?: string; children: (id: string) => ReactNode }) {
  const id = useId()
  return (
    <div className="flex min-w-0 flex-col gap-1">
      <label htmlFor={id} className="cursor-pointer text-sm font-medium text-ink">
        {label}
      </label>
      {children(id)}
      {hint ? <p className="text-xs text-ink-soft">{hint}</p> : null}
    </div>
  )
}

/**
 * Laptop card for the offline photo download (DESIGN §17): turn it on, the port, the laptop's
 * address on the guests' Wi-Fi (empty detects it) and the Wi-Fi the TV's first QR joins. Saving
 * restarts the local server; the status says whether it is listening. On the home screen it is one
 * row (title, status, `Configurar`) so the page fits 1280×800 without scrolling; `Configurar` opens
 * the fields in a panel portalled to `document.body`, so Enter there never submits the event form.
 */
export function ShareSettingsCard() {
  const [state, setState] = useShareState()
  const [form, setForm] = useState<ShareSettings | null>(null)
  const [port, setPort] = useState('')
  const [notice, setNotice] = useState<'saved' | 'invalid' | null>(null)
  const [loadError, setLoadError] = useState(false)
  const [saving, setSaving] = useState(false)
  const [open, setOpen] = useState(false)
  const panelTitleId = useId()

  useEffect(() => {
    if (!open) return
    const onKey = (event: KeyboardEvent) => event.key === 'Escape' && setOpen(false)
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open])

  useEffect(() => {
    let active = true
    window.fotomagica.share
      .getSettings()
      .then((value) => {
        if (!active) return
        setForm(value)
        setPort(String(value.port))
      })
      .catch(() => active && setLoadError(true))
    return () => {
      active = false
    }
  }, [])

  if (loadError) return <p className="text-sm text-danger">{SHARE_COPY.loadError}</p>
  if (!form) return <p className="text-sm text-ink-soft">{SHARE_COPY.loading}</p>

  const update = (patch: Partial<ShareSettings>) => {
    setForm({ ...form, ...patch })
    setNotice(null)
  }
  const updateWifi = (patch: Partial<ShareSettings['wifi']>) => update({ wifi: { ...form.wifi, ...patch } })

  const save = () => {
    const parsed = shareSettingsSchema.safeParse({ ...form, port: Number(port), hostOverride: form.hostOverride.trim() })
    if (!parsed.success) {
      setNotice('invalid')
      return
    }
    setSaving(true)
    window.fotomagica.share
      .saveSettings(parsed.data)
      .then((next) => {
        setState(next)
        setForm(parsed.data)
        setNotice('saved')
      })
      .catch(() => setNotice('invalid'))
      .finally(() => setSaving(false))
  }

  const off = !form.enabled
  const status = (
    <p role="status" data-testid="share-status" className={cn('min-w-0 text-sm', state?.status === 'error' || notice === 'invalid' ? 'text-danger' : 'text-ink-soft')}>
      {notice === 'invalid' ? C.invalid : state ? SHARE_COPY.status(state) : null}
      {notice === 'saved' ? ` · ${C.saved}` : null}
    </p>
  )
  return (
    <section aria-labelledby="share-settings-title" data-testid="share-settings" className="flex min-w-0 items-center justify-between gap-3 border-t border-line pt-4">
      <div className="min-w-0">
        <h2 id="share-settings-title" className="eyebrow">
          {C.title}
        </h2>
        {open ? null : status}
      </div>
      <Button variant="ghost" aria-haspopup="dialog" aria-expanded={open} onClick={() => setOpen(true)}>
        {C.open}
      </Button>
      {open
        ? createPortal(
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-6" onClick={(event) => event.target === event.currentTarget && setOpen(false)}>
              <div role="dialog" aria-modal="true" aria-labelledby={panelTitleId} data-testid="share-settings-panel" className="max-h-full w-full max-w-4xl overflow-y-auto rounded-[var(--radius-card)] border border-line bg-bg-raised px-8 py-6 text-ink">
                <h2 id={panelTitleId} className="font-display text-3xl">
                  {C.title}
                </h2>
                <p className="mt-1 text-sm text-ink-soft">{C.description}</p>
                <label className="mt-4 flex min-h-11 cursor-pointer items-center gap-3 text-sm text-ink">
                  <input type="checkbox" className="size-5 cursor-pointer accent-ink" checked={form.enabled} onChange={(event) => update({ enabled: event.target.checked })} />
                  {C.enabled}
                </label>
                <div className="mt-3 grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
                  <Field label={C.ssid}>{(id) => <input id={id} className={FIELD} disabled={off} maxLength={32} autoComplete="off" value={form.wifi.ssid} onChange={(event) => updateWifi({ ssid: event.target.value })} />}</Field>
                  <Field label={C.password}>
                    {(id) => (
                      <input id={id} className={FIELD} disabled={off || form.wifi.security === 'nopass'} maxLength={63} autoComplete="off" value={form.wifi.password} onChange={(event) => updateWifi({ password: event.target.value })} />
                    )}
                  </Field>
                  <Field label={C.security}>
                    {(id) => (
                      <select id={id} className={cn(FIELD, 'cursor-pointer')} disabled={off} value={form.wifi.security} onChange={(event) => updateWifi({ security: event.target.value as ShareSettings['wifi']['security'] })}>
                        {WIFI_SECURITIES.map((option) => (
                          <option key={option} value={option}>
                            {C.securities[option]}
                          </option>
                        ))}
                      </select>
                    )}
                  </Field>
                  <Field label={C.host} hint={C.hostHint}>
                    {(id) => <input id={id} className={FIELD} disabled={off} inputMode="decimal" autoComplete="off" placeholder="192.168.137.1" value={form.hostOverride} onChange={(event) => update({ hostOverride: event.target.value })} />}
                  </Field>
                  <Field label={C.port}>
                    {(id) => (
                      <input
                        id={id}
                        className={FIELD}
                        disabled={off}
                        inputMode="numeric"
                        autoComplete="off"
                        value={port}
                        onChange={(event) => {
                          setPort(event.target.value.replace(/\D/g, '').slice(0, 5))
                          setNotice(null)
                        }}
                      />
                    )}
                  </Field>
                  <label className="flex min-h-11 cursor-pointer items-center gap-3 self-end text-sm text-ink">
                    <input type="checkbox" className="size-5 cursor-pointer accent-ink" disabled={off} checked={form.wifi.hidden} onChange={(event) => updateWifi({ hidden: event.target.checked })} />
                    {C.hidden}
                  </label>
                </div>
                <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                  {status}
                  <div className="flex gap-3">
                    <Button variant="ghost" onClick={() => setOpen(false)}>
                      {C.close}
                    </Button>
                    <Button onClick={save} disabled={saving}>
                      {C.save}
                    </Button>
                  </div>
                </div>
              </div>
            </div>,
            document.body,
          )
        : null}
    </section>
  )
}
