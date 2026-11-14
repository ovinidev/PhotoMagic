import markUrl from '@brand/mark.png'
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

/** Laptop window shell: header with the symbol, the current page, and the app version. */
export function OperatorApp() {
  const version = useAppVersion()

  return (
    <div className="flex min-h-full flex-col bg-bg text-ink">
      <header className="flex h-16 items-center gap-3 border-b border-line px-6">
        <img src={markUrl} alt="" aria-hidden className="size-9" draggable={false} />
        <span className="sr-only">Foto Mágica</span>
      </header>
      <main className="flex flex-1 justify-center">
        <HomePage />
      </main>
      <footer className="px-6 py-3 text-right text-xs text-ink-soft" data-testid="app-version">
        <VersionLabel state={version} />
      </footer>
    </div>
  )
}
