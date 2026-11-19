import { useState } from 'react'
import logoUrl from '@brand/logo.png'
import type { PrintMode } from '@shared/layout'
import { CreateEventForm } from '@renderer/features/events'
import { LayoutEditor } from '@renderer/features/layout'
import { ShareSettingsCard } from '@renderer/features/share'

/**
 * Home screen: only creates an event, never lists old ones (PRD §4.5). Not a feature: it composes
 * `events` and `layout`. The slot editor opens over the form, which keeps what was typed. With an
 * event open this page is not shown, so the editor is not reachable during the party (PRD §6.3).
 */
export function HomePage() {
  const [editing, setEditing] = useState<PrintMode | null>(null)
  return (
    <div className="mx-auto flex w-full min-w-0 max-w-[1280px] flex-col items-center px-6 py-5">
      {/* RNF12: the full logo on the create-event screen, beside the title so the form fits the window. */}
      <CreateEventForm onEditLayout={setEditing} logo={<img src={logoUrl} alt="Foto Mágica" className="h-16 w-auto" draggable={false} />} />
      <div className="mt-5 w-full min-w-0">
        <ShareSettingsCard />
      </div>
      {editing ? <LayoutEditor initialMode={editing} onClose={() => setEditing(null)} /> : null}
    </div>
  )
}
