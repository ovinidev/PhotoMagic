import { AttractScreen } from '@renderer/features/attract'
import { CameraView, CloseHoldLayer } from '@renderer/features/camera'
import { PrintScreen } from '@renderer/features/print'
import { useSessionState } from '@renderer/shared/hooks/useSessionState'
import { guestScreen } from './screens'

/**
 * TV window shell, 1080×1920 logical portrait. Main only creates this window when the event starts,
 * so the camera opens right away (DESIGN §14: dark glass over the image, no logo on it). After the
 * third photo the print screen sits over the darkened camera, which stays open for the next round.
 * Screen changes are instant. A fresh round left untouched brings up the attract screen over the
 * camera; a tap hides it and the round goes on (DESIGN §14, Attract screen). Two fingers held for
 * 2 s hide this window; the laptop reopens it (DESIGN §3).
 */
export function GuestApp() {
  const [view] = useSessionState()
  const session = view.status === 'ready' && view.value.kind === 'event' ? view.value : null
  const screen = guestScreen(session)

  return (
    <main className="relative h-full w-full overflow-hidden bg-black">
      <CameraView session={session} />
      {screen === 'print' && session ? (
        <div data-testid="guest-screen" className="absolute inset-0">
          <PrintScreen session={session} />
        </div>
      ) : null}
      <AttractScreen active={screen === 'camera' && session !== null && session.taken === 0} />
      <CloseHoldLayer />
    </main>
  )
}
