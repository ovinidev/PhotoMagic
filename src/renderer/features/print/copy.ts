import type { PrintFailureReason } from '@shared/ipc'

/** pt-BR copy of printing, on the TV and on the laptop (PRD §6.5, DESIGN §10). */
export const PRINT_COPY = {
  print: 'Imprimir',
  cancel: 'Cancelar',
  more: 'Mais',
  less: 'Menos',
  again: 'Imprimir novamente',
  newRound: 'Nova rodada',
  retry: 'Tentar novamente',
  printing: 'Imprimindo…',
  printed: 'Montagem impressa',
  previewAlt: 'Prévia da montagem',
  previewLoading: 'Montando a prévia…',
  previewError: 'Não foi possível mostrar a prévia',
  failures: {
    offline: 'Impressora desligada',
    'no-paper': 'Impressora sem papel',
    'no-ribbon': 'Impressora sem ribbon',
    'cut-unavailable': 'Não foi possível ajustar o corte da impressora',
    failed: 'Não foi possível imprimir',
    'save-failed': 'Não foi possível salvar a montagem',
  } satisfies Record<PrintFailureReason, string>,
  savedKept: (fileName: string) => `A montagem ${fileName} ficou salva na pasta do evento.`,
} as const

/** `1 Cópia`, `2 Cópias` (RF10). */
export function copiesLabel(copies: number): string {
  return `${copies} ${copies === 1 ? 'Cópia' : 'Cópias'}`
}
