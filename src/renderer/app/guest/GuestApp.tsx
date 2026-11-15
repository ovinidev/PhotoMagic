import { CameraView } from '@renderer/features/camera'

/**
 * TV window shell, 1080×1920 logical portrait. Main only creates this window when the TV opens,
 * so the camera surface starts right away (DESIGN §14: dark glass over the image, no logo on it).
 */
export function GuestApp() {
  return (
    <main className="h-full w-full bg-black">
      <CameraView />
    </main>
  )
}
