import type { EventSession } from '@shared/ipc'
import { CameraStatusLine, TvStatus, useDisplayState } from '@renderer/features/camera'
import { LivePreview } from './LivePreview'
import { MontagePreview } from './MontagePreview'
import { RoundControls } from './RoundControls'

/**
 * The laptop during the party (PRD §6.3): the live camera with the crop guide, the round's montage
 * and its controls, and the TV and camera state. Framing, gallery and printer status land with
 * their milestones.
 */
export function RoundScreen({ session }: { session: EventSession }) {
  const [display] = useDisplayState()
  return (
    <div className="grid w-full max-w-[1400px] grid-cols-[auto_1fr] gap-8 px-8 py-8">
      <LivePreview session={session} />
      <div className="flex min-w-0 flex-col gap-8">
        <MontagePreview revision={session.previewRevision} />
        <section className="rounded-[var(--radius-card)] border border-line bg-bg-raised p-6">
          <RoundControls session={session} />
        </section>
        <section className="flex flex-col gap-4 rounded-[var(--radius-card)] border border-line bg-bg-raised p-6">
          <TvStatus view={display} />
          <CameraStatusLine />
        </section>
      </div>
    </div>
  )
}
