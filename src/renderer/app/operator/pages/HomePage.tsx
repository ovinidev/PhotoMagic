import { useState } from 'react'
import logoUrl from '@brand/logo.png'
import type { PrintMode } from '@shared/layout'
import { CreateEventForm } from '@renderer/features/events'
import { LayoutEditor } from '@renderer/features/layout'

/**
 * Home screen: only creates an event, never lists old ones (PRD §4.5). Not a feature: it composes
 * `events` and `layout`. The slot editor opens over the form, which keeps what was typed. With an
 * event open this page is not shown, so the editor is not reachable during the party (PRD §6.3).
 */
export function HomePage() {
  const [editing, setEditing] = useState<PrintMode | null>(null)
  return (
    <div className="mx-auto flex w-full max-w-[720px] flex-col items-center gap-10 px-6 py-12">
      <img src={logoUrl} alt="Foto Mágica" className="h-40 w-auto" draggable={false} />
      <CreateEventForm onEditLayout={setEditing} />
      {editing ? <LayoutEditor initialMode={editing} onClose={() => setEditing(null)} /> : null}
    </div>
  )
}
