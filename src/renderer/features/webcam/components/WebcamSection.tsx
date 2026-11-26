import { WEBCAM_COPY } from '../copy'
import { WebcamPanel } from './WebcamPanel'

/** The webcam panel as a laptop card on the event screen (PRD §6.3, §6.7). */
export function WebcamSection() {
  return (
    <section aria-label={WEBCAM_COPY.title} className="flex flex-col gap-4 rounded-[var(--radius-card)] border border-line bg-bg-raised p-6">
      <h2 className="eyebrow">{WEBCAM_COPY.title}</h2>
      <WebcamPanel surface="laptop" />
    </section>
  )
}
