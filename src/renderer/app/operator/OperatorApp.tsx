import logoUrl from '@brand/logo.png'
import markUrl from '@brand/mark.png'
import { EndEventButton, RoundScreen, SESSION_COPY } from '@renderer/features/session'
import { useSessionState } from '@renderer/shared/hooks/useSessionState'
import { useAppVersion, type AppVersionState } from './hooks/useAppVersion'
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
      <footer className="px-6 py-3 text-right text-xs text-ink-soft" data-testid="app-version">
        <VersionLabel state={version} />
      </footer>
    </div>
  )
}
