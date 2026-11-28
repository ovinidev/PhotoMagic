import { useState } from 'react'
import logoUrl from '@brand/logo.png'
import type { PrintMode } from '@shared/layout'
import { CreateEventForm } from '@renderer/features/events'
import { LayoutEditor } from '@renderer/features/layout'
import { PrinterSettingsCard } from '@renderer/features/print'
import { ShareSettingsCard } from '@renderer/features/share'

/**
 * Home screen: only creates an event, never lists old ones (PRD §4.5). Not a feature: it composes
 * `events` and `layout`. The slot editor opens over the form, which keeps what was typed. With an
 * event open this page is not shown, so the editor is not reachable during the party (PRD §6.3).
 */
export function HomePage() {
  const [editing, setEditing] = useState<PrintMode | null>(null)
  // Bumped when the editor closes: the create-event preview reads the saved boxes again.
  const [layoutRevision, setLayoutRevision] = useState(0)
  return (
    <div className="mx-auto flex w-full min-w-0 max-w-[1280px] flex-col items-center px-6 pt-1 pb-5">
      {/* RNF12: the full logo on the create-event screen, beside the title so the form fits the window. */}
      {/* The photo-download row sits in the form's left column so 1280×800 keeps no vertical scroll. */}
      <CreateEventForm onEditLayout={setEditing} layoutRevision={layoutRevision} logo={<img src={logoUrl} alt="Foto Mágica" className="h-14 w-auto" draggable={false} />} footer={
          <>
            <PrinterSettingsCard />
            <ShareSettingsCard />
          </>
        } />
      {editing ? <LayoutEditor
          initialMode={editing}
          onClose={() => {
            setEditing(null)
            setLayoutRevision((revision) => revision + 1)
          }}
        /> : null}
    </div>
  )
}
