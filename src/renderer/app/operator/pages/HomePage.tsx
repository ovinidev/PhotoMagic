import logoUrl from '@brand/logo.png'
import { CreateEventCard } from '@renderer/features/events'

/** Home screen: only creates an event, never lists old ones (PRD §4.5). Not a feature: it composes them. */
export function HomePage() {
  return (
    <div className="mx-auto flex w-full max-w-[720px] flex-col items-center gap-10 px-6 py-12">
      <img src={logoUrl} alt="Foto Mágica" className="h-40 w-auto" draggable={false} />
      <CreateEventCard />
    </div>
  )
}
