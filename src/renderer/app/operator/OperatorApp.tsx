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
 * Laptop zoom (DESIGN §3): − and + step the operator's zoom, the percentage resets it to 100%. The
 * same steps answer Ctrl − / Ctrl + / Ctrl 0 and Ctrl + wheel. The automatic factor for the window
 * size comes on top and is not part of the percentage.
 */
function ZoomControls({ state, onStep }: { state: ZoomState | null; onStep: (step: 'in' | 'out' | 'reset') => void }) {
  const percent = Math.round((state?.user ?? 1) * 100)
  const button =
    'inline-flex min-h-11 min-w-11 cursor-pointer items-center justify-center rounded-[var(--radius-field)] border border-line text-base font-medium text-ink hover:bg-bg-raised focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink'
  return (
    <div role="group" aria-label="Zoom da tela" className="flex items-center gap-1" data-testid="zoom-controls">
      <button type="button" className={button} aria-label="Diminuir zoom (Ctrl −)" onClick={() => onStep('out')}>
        −
      </button>
      <button
        type="button"
        className={`${button} min-w-16 px-2 tabular-nums`}
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
 * Laptop window shell: header with the symbol (and the event name while one is open), the page, and
 * the app version. With an event open the page is the round; otherwise the create-event home.
 */
export function OperatorApp() {
  const version = useAppVersion()
  const update = useUpdateStatus()
  const zoom = useZoom()
  const [sessionView] = useSessionState()
  const session = sessionView.status === 'ready' && sessionView.value.kind === 'event' ? sessionView.value : null

  return (
    <div className="flex min-h-full flex-col bg-bg text-ink">
      <header className="flex h-16 items-center gap-3 border-b border-line px-6">
        <img src={markUrl} alt="" aria-hidden className="size-9" draggable={false} />
        <span className="sr-only">Foto Mágica</span>
        {session ? (
          <>
            <p data-testid="event-title" className="font-semibold text-ink">
              {session.name}
              <span className="ml-2 text-sm font-normal text-ink-soft">{SESSION_COPY.modes[session.mode]}</span>
            </p>
            <div className="ml-auto">
              <EndEventButton />
            </div>
          </>
        ) : null}
      </header>
      <main className="flex flex-1 justify-center">
        {sessionView.status === 'loading' ? <Splash /> : session ? <RoundScreen session={session} /> : <HomePage />}
      </main>
      <footer className="flex items-center justify-end gap-4 px-6 py-2 text-sm text-ink-soft">
        <div className="mr-auto">
          <ZoomControls state={zoom.state} onStep={zoom.step} />
        </div>
        <UpdateLabel status={update} />
        <span data-testid="app-version">
          <VersionLabel state={version} />
        </span>
      </footer>
    </div>
  )
}
