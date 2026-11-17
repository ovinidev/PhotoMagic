import logoUrl from '@brand/logo.png'
import markUrl from '@brand/mark.png'
import { EndEventButton, RoundScreen, SESSION_COPY } from '@renderer/features/session'
import { useSessionState } from '@renderer/shared/hooks/useSessionState'
import type { UpdateStatus, ZoomState } from '@shared/ipc'
import { useAppVersion, type AppVersionState } from './hooks/useAppVersion'
import { useUpdateStatus } from './hooks/useUpdateStatus'
import { useZoom } from './hooks/useZoom'
import { HomePage } from './pages/HomePage'

function VersionLabel({ state }: { state: AppVersionState }) {
  switch (state.status) {
    case 'loading':
      return <span>Carregando versão…</span>
    case 'error':
      return <span className="text-danger">Não foi possível ler a versão do app</span>
    case 'ready':
      return <span className="tabular-nums">Versão {state.value.version}</span>
  }
}

/** Discreet line next to the version (RNF09): nothing unless an update is downloading or waiting for quit. */
function UpdateLabel({ status }: { status: UpdateStatus }) {
  switch (status.kind) {
    case 'idle':
      return null
    case 'downloading':
      return (
        <span data-testid="update-status" className="tabular-nums">
          Baixando atualização {status.version} ({status.percent}%)
        </span>
      )
    case 'ready':
      return (
        <span data-testid="update-status">
          Atualização {status.version} pronta: será instalada ao fechar o app
        </span>
      )
  }
}

/**
 * Laptop zoom (DESIGN §3), in the header: − and + step the operator's zoom, the percentage resets it to 100%. The
 * same steps answer Ctrl − / Ctrl + / Ctrl 0 and Ctrl + wheel. The automatic factor for the window
 * size comes on top and is not part of the percentage.
 */
function ZoomControls({ state, onStep }: { state: ZoomState | null; onStep: (step: 'in' | 'out' | 'reset') => void }) {
  const percent = Math.round((state?.user ?? 1) * 100)
  const button =
    'inline-flex h-8 min-w-8 cursor-pointer items-center justify-center rounded-[var(--radius-field)] border border-line text-[13px] font-medium text-ink hover:bg-bg-raised focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink'
  return (
    <div role="group" aria-label="Zoom da tela" className="flex items-center gap-1" data-testid="zoom-controls">
      <button type="button" className={button} aria-label="Diminuir zoom (Ctrl −)" onClick={() => onStep('out')}>
        −
      </button>
      <button
        type="button"
        className={`${button} min-w-14 px-2 tabular-nums`}
        aria-label={`Zoom ${percent}%. Voltar para 100% (Ctrl 0)`}
        data-testid="zoom-percent"
        onClick={() => onStep('reset')}
      >
        {percent}%
      </button>
      <button type="button" className={button} aria-label="Aumentar zoom (Ctrl +)" onClick={() => onStep('in')}>
        +
      </button>
    </div>
  )
}

/** Startup (RNF12): the full logo, centered, until main says whether an event is open. */
function Splash() {
  return (
    <div data-testid="startup-splash" className="flex flex-1 items-center justify-center">
      <img src={logoUrl} alt="Foto Mágica" className="h-56 w-auto" draggable={false} />
    </div>
  )
}

/**
 * Laptop window shell: header with the symbol (and the event name while one is open), the app
 * version, update status and zoom, then the page. With an event open the page is the round; otherwise the create-event home.
 */
export function OperatorApp() {
  const version = useAppVersion()
  const update = useUpdateStatus()
  const zoom = useZoom()
  const [sessionView] = useSessionState()
  const session = sessionView.status === 'ready' && sessionView.value.kind === 'event' ? sessionView.value : null

  return (
    <div className="flex h-full min-h-0 flex-col bg-bg text-ink">
      <header className="flex h-14 shrink-0 items-center gap-3 border-b border-line px-6">
        <img src={markUrl} alt="" aria-hidden className="size-8" draggable={false} />
        <span className="sr-only">Foto Mágica</span>
        {session ? (
          <p data-testid="event-title" className="min-w-0 truncate font-semibold text-ink">
            {session.name}
            <span className="ml-2 text-sm font-normal text-ink-soft">{SESSION_COPY.modes[session.mode]}</span>
          </p>
        ) : null}
        {/* Version, update status and laptop zoom live here so no page needs a footer (or a vertical scroll). */}
        <div className="ml-auto flex shrink-0 items-center gap-4 text-[13px] text-ink-soft">
          <UpdateLabel status={update} />
          <span data-testid="app-version">
            <VersionLabel state={version} />
          </span>
          <ZoomControls state={zoom.state} onStep={zoom.step} />
          {session ? <EndEventButton /> : null}
        </div>
      </header>
      <main className="flex min-h-0 flex-1 justify-center overflow-auto">
        {sessionView.status === 'loading' ? <Splash /> : session ? <RoundScreen session={session} /> : <HomePage />}
      </main>
    </div>
  )
}
