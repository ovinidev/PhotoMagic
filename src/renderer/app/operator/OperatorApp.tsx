import logoUrl from '@brand/logo.png'
import { CameraAlert } from '@renderer/features/camera'
import { PrinterAlert } from '@renderer/features/print'
import { EndEventButton, RoundScreen, SESSION_COPY } from '@renderer/features/session'
import { EventGalleryQr, useShareState } from '@renderer/features/share'
import { useSessionState } from '@renderer/shared/hooks/useSessionState'
import type { UpdateStatus } from '@shared/ipc'
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
 * version and update status, then the page. With an event open the page is the round; otherwise the create-event home.
 */
export function OperatorApp() {
  const version = useAppVersion()
  const update = useUpdateStatus()
  // Mounts the Ctrl + / Ctrl − / Ctrl 0 and Ctrl + wheel zoom handlers (DESIGN §3); there are no header buttons.
  useZoom()
  const [sessionView] = useSessionState()
  const session = sessionView.status === 'ready' && sessionView.value.kind === 'event' ? sessionView.value : null
  const [share] = useShareState()

  return (
    <div className="flex h-full min-h-0 flex-col bg-bg text-ink">
      {/*
        No branded header: the create-event card already carries the logo and the name. The version and
        update status sit alone in the top-right corner; during an event the same top row adds the event
        name and the controls the operator needs (alerts, `Encerrar evento`), still without a logo.
      */}
      {session ? (
        <div className="flex h-14 shrink-0 items-center gap-4 px-8">
          <p data-testid="event-title" className="flex min-w-0 items-baseline gap-3 truncate">
            <span className="font-display truncate text-2xl text-ink">{session.name}</span>
            <span className="eyebrow">{SESSION_COPY.modes[session.mode]}</span>
          </p>
          <div className="ml-auto flex shrink-0 items-center gap-4 text-[13px] text-ink-soft">
            <UpdateLabel status={update} />
            <span data-testid="app-version">
              <VersionLabel state={version} />
            </span>
            <CameraAlert />
            <PrinterAlert />
            <EndEventButton />
          </div>
        </div>
      ) : (
        <div className="flex h-9 shrink-0 items-center justify-end gap-4 px-6 text-[13px] text-ink-soft">
          <UpdateLabel status={update} />
          <span data-testid="app-version">
            <VersionLabel state={version} />
          </span>
        </div>
      )}
      <main className="flex min-h-0 flex-1 justify-center overflow-auto">
        {sessionView.status === 'loading' ? <Splash /> : session ? <RoundScreen session={session} /> : <HomePage />}
      </main>
      {/* DESIGN §17: the event gallery QR, under the page so it never adds a vertical scroll. */}
      {session ? <EventGalleryQr state={share} /> : null}
    </div>
  )
}
