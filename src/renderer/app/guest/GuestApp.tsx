import type { ReactNode } from 'react'
import { CameraView, CloseHoldLayer } from '@renderer/features/camera'
import { PrintScreen } from '@renderer/features/print'
import { useSessionState } from '@renderer/shared/hooks/useSessionState'
import { guestScreen, transitionClass } from './screens'
import { useScreenTransition } from './useScreenTransition'

/** One guest screen over the camera. A leaving layer is inert and hidden from assistive tech. */
function ScreenLayer({ className, leaving, onAnimationEnd, children }: { className?: string | undefined; leaving?: boolean; onAnimationEnd?: () => void; children: ReactNode }) {
  return (
    <div
      data-testid={leaving ? 'guest-screen-leaving' : 'guest-screen'}
      className={className ? `absolute inset-0 ${className}` : 'absolute inset-0'}
      inert={leaving}
      aria-hidden={leaving || undefined}
      onAnimationEnd={(event) => {
        if (event.target === event.currentTarget) onAnimationEnd?.()
      }}
    >
      {children}
    </div>
  )
}

/**
 * TV window shell, 1080×1920 logical portrait. Main only creates this window when the event starts,
 * so the camera opens right away (DESIGN §14: dark glass over the image, no logo on it). After the
 * third photo the print screen floats over the darkened camera, which stays open for the next round.
 * Screen changes animate here, not in each screen: forward fades and zooms the print screen in, back
 * slides it out over the camera (DESIGN §14, Motion). Two fingers held for 2 s hide this window; the
 * laptop reopens it (DESIGN §3).
 */
export function GuestApp() {
  const [view] = useSessionState()
  const session = view.status === 'ready' && view.value.kind === 'event' ? view.value : null
  const screen = guestScreen(session)
  const { direction, leaving, endLeaving } = useScreenTransition(screen, session)

  return (
    <main className="relative h-full w-full overflow-hidden bg-black">
      <CameraView session={session} />
      {leaving?.screen === 'print' && leaving.payload ? (
        <ScreenLayer leaving className={transitionClass(direction, 'leaving')} onAnimationEnd={endLeaving}>
          <PrintScreen session={leaving.payload} />
        </ScreenLayer>
      ) : null}
      {screen === 'print' && session ? (
        <ScreenLayer className={transitionClass(direction, 'entering')}>
          <PrintScreen session={session} />
        </ScreenLayer>
      ) : null}
      <CloseHoldLayer />
    </main>
  )
}
