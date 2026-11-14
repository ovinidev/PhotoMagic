import { Button } from '@renderer/shared/components/ui/button'

/**
 * Placeholder for the create-event form (PRD §6.1, RF01). The name, mode and template fields land
 * with the events feature; until then `Iniciar evento` stays disabled, as it does without a template.
 */
export function CreateEventCard() {
  return (
    <section
      aria-labelledby="create-event-title"
      className="w-full rounded-[var(--radius-card)] border border-line bg-bg-raised p-8"
    >
      <h1 id="create-event-title" className="text-2xl font-semibold text-ink">
        Novo evento
      </h1>
      <p className="mt-2 text-ink-soft">Nome do evento, modo (2 tiras ou 1 tira) e template chegam na próxima etapa.</p>
      <div className="mt-8 flex justify-end">
        <Button disabled>Iniciar evento</Button>
      </div>
    </section>
  )
}
