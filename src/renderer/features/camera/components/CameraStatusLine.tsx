import { cn } from '@renderer/shared/utils/cn'
import { CAMERA_COPY } from '../copy'
import { useCameraStatus, type CameraStatusState } from '../hooks/useCameraStatus'

type Line = { tone: 'ok' | 'danger' | 'neutral'; title: string; detail?: string }

function describe(state: CameraStatusState): Line {
  if (state.status === 'loading') return { tone: 'neutral', title: 'Lendo o estado da câmera…' }
  if (state.status === 'error') return { tone: 'danger', title: 'Não foi possível ler o estado da câmera' }
  const status = state.value
  switch (status.kind) {
    case 'idle':
      return { tone: 'neutral', title: 'Câmera fechada', detail: 'A câmera abre junto com a tela da TV.' }
    case 'starting':
      return { tone: 'neutral', title: 'Abrindo a câmera na TV…' }
    case 'live': {
      const size = status.width > 0 && status.height > 0 ? `${status.width} × ${status.height}` : ''
      const detail = [status.label, size].filter(Boolean).join(' · ')
      return { tone: 'ok', title: 'Câmera ao vivo', ...(detail ? { detail } : {}) }
    }
    case 'error':
      return { tone: 'danger', ...CAMERA_COPY.errors[status.reason] }
  }
}

const DOT = { ok: 'bg-ok', danger: 'bg-danger', neutral: 'bg-ink-soft/40' } as const

/** Laptop: one line with the TV camera state (DESIGN §14, laptop tokens). */
export function CameraStatusLine() {
  const line = describe(useCameraStatus())
  return (
    <div role="status" aria-live="polite" data-testid="camera-status" className="flex items-start gap-3">
      <span aria-hidden className={cn('mt-1.5 size-2.5 shrink-0 rounded-full', DOT[line.tone])} />
      <div>
        <p className={cn('font-medium', line.tone === 'danger' ? 'text-danger' : 'text-ink')}>{line.title}</p>
        {line.detail ? <p className="text-sm text-ink-soft tabular-nums">{line.detail}</p> : null}
      </div>
    </div>
  )
}
