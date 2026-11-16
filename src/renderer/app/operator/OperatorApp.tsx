import logoUrl from '@brand/logo.png'
import markUrl from '@brand/mark.png'
import { EndEventButton, RoundScreen, SESSION_COPY } from '@renderer/features/session'
import { useSessionState } from '@renderer/shared/hooks/useSessionState'
import type { UpdateStatus } from '@shared/ipc'
import { useAppVersion, type AppVersionState } from './hooks/useAppVersion'
import { useUpdateStatus } from './hooks/useUpdateStatus'
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
      <footer className="flex justify-end gap-4 px-6 py-3 text-xs text-ink-soft">
        <UpdateLabel status={update} />
        <span data-testid="app-version">
          <VersionLabel state={version} />
        </span>
      </footer>
    </div>
  )
}
