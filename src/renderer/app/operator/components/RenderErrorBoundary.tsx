import { Component, type ErrorInfo, type ReactNode } from 'react'
import { Button } from '@renderer/shared/components/ui/button'

export const RENDER_ERROR_COPY = {
  title: 'Algo deu errado nesta tela.',
  hint: 'O evento e a rodada continuam salvos na memória. Recarregue a tela para continuar.',
  reload: 'Recarregar',
} as const

type Props = { children: ReactNode; onReload?: () => void }
type State = { failed: boolean }

/**
 * Keeps a render exception from blanking the laptop window. The event and the round live in the
 * main process, so reloading the renderer is safe and picks the state back up.
 */
export class RenderErrorBoundary extends Component<Props, State> {
  override state: State = { failed: false }

  static getDerivedStateFromError(): State {
    return { failed: true }
  }

  override componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error('[renderer] render failed', error, info.componentStack)
  }

  override render(): ReactNode {
    if (!this.state.failed) return this.props.children
    const reload = this.props.onReload ?? (() => window.location.reload())
    return (
      <div role="alert" className="flex h-full flex-col items-center justify-center gap-4 p-6 text-center">
        <p className="text-lg font-semibold text-ink">{RENDER_ERROR_COPY.title}</p>
        <p className="max-w-md text-sm text-ink-soft">{RENDER_ERROR_COPY.hint}</p>
        <Button className="min-h-11 cursor-pointer" onClick={reload}>
          {RENDER_ERROR_COPY.reload}
        </Button>
      </div>
    )
  }
}
