import type { EventSession } from '@shared/ipc'
import { CameraStatusLine, TvStatus, useDisplayState } from '@renderer/features/camera'
import { GalleryPanel } from '@renderer/features/gallery'
import { PrinterStatusLine } from '@renderer/features/print'
import { WebcamSection } from '@renderer/features/webcam'
import { useFramingEditor } from './FramingEditor'
import { MontagePreview } from './MontagePreview'
import { RoundControls } from './RoundControls'

/**
 * The laptop event screen shows the montage, framing, round controls and equipment status.
 */
export function RoundScreen({ session }: { session: EventSession }) {
  const [display] = useDisplayState()
  const framing = useFramingEditor(session)
  return (
    <div className="grid w-full max-w-[1400px] items-start gap-8 px-4 py-8 sm:px-8 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
      <MontagePreview revision={session.previewRevision} overlay={framing.overlay} footer={framing.controls} />
      <div className="flex min-w-0 flex-col gap-8">
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
