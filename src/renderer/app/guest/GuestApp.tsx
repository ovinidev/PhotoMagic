import { CameraView } from '@renderer/features/camera'
import { PrintScreen } from '@renderer/features/print'
import { useSessionState } from '@renderer/shared/hooks/useSessionState'

/**
 * TV window shell, 1080×1920 logical portrait. Main only creates this window when the event starts,
 * so the camera opens right away (DESIGN §14: dark glass over the image, no logo on it). After the
 * third photo the print screen floats over the darkened camera, which stays open for the next round.
 */
export function GuestApp() {
  const [view] = useSessionState()
  const session = view.status === 'ready' && view.value.kind === 'event' ? view.value : null

  return (
    <main className="relative h-full w-full bg-black">
      <CameraView session={session} />
      {session && session.phase.kind !== 'capturing' ? <PrintScreen session={session} /> : null}
    </main>
  )
}
