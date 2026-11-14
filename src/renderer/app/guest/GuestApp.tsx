/**
 * TV window shell, 1080×1920 portrait. The camera surface (features/camera) replaces this
 * placeholder; the TV is dark glass over the image, not the laptop's light form (DESIGN §14).
 */
export function GuestApp() {
  return (
    <div className="flex h-full items-center justify-center bg-black text-white">
      <p className="text-2xl font-semibold">Aguardando o início do evento</p>
    </div>
  )
}
