import type { EventSession } from '@shared/ipc'
import { CameraStatusLine, TvStatus, useDisplayState } from '@renderer/features/camera'
import { GalleryPanel } from '@renderer/features/gallery'
import { PrinterStatusLine } from '@renderer/features/print'
import { WebcamSection } from '@renderer/features/webcam'
import { useFramingEditor } from './FramingEditor'
import { LivePreview } from './LivePreview'
import { MontagePreview } from './MontagePreview'
import { RoundControls } from './RoundControls'

/**
 * The laptop during the party (PRD §6.3): the live camera with the crop guide, the round's montage
 * with the framing of each slot (RF09) and its controls, and the TV, camera and printer state.
 */
export function RoundScreen({ session }: { session: EventSession }) {
  const [display] = useDisplayState()
  const framing = useFramingEditor(session)
  return (
    <div className="grid w-full max-w-[1400px] grid-cols-[auto_1fr] gap-8 px-8 py-8">
      <LivePreview session={session} />
      <div className="flex min-w-0 flex-col gap-8">
        <MontagePreview revision={session.previewRevision} overlay={framing.overlay} footer={framing.controls} />
        <section className="rounded-[var(--radius-card)] border border-line bg-bg-raised p-6">
          <RoundControls session={session} />
        </section>
        <section className="flex flex-col gap-4 rounded-[var(--radius-card)] border border-line bg-bg-raised p-6">
          <TvStatus view={display} />
          <CameraStatusLine />
          <PrinterStatusLine />
        </section>
        <WebcamSection />
        <GalleryPanel />
      </div>
    </div>
  )
}
