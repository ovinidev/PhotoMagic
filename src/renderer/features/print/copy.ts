import type { PrintFailureReason, PrinterStatus } from '@shared/ipc'

/** pt-BR copy of printing, on the TV and on the laptop (PRD §6.5, DESIGN §10). */
export const PRINT_COPY = {
  print: 'Imprimir',
  cancel: 'Cancelar',
  more: 'Mais',
  less: 'Menos',
  again: 'Imprimir novamente',
  newRound: 'Nova rodada',
  retry: 'Tentar novamente',
  /** The print animation's line for each real job stage (DESIGN §14). */
  stage: {
    saving: 'Preparando sua foto…',
    sending: 'Imprimindo…',
    done: 'Sua foto está pronta!',
  },
  progress: 'Progresso da impressão',
  previewAlt: 'Prévia da montagem',
  previewLoading: 'Montando a prévia…',
  previewError: 'Não foi possível mostrar a prévia',
  failures: {
    offline: 'Impressora desligada',
    'no-paper': 'Impressora sem papel',
    'no-ribbon': 'Impressora sem ribbon',
    paused: 'A fila da impressora está pausada no Windows',
    'printer-error': 'A impressora informou um erro',
    'not-found': 'Impressora DS-RX1 não encontrada',
    'cut-unavailable': 'Não foi possível ajustar o corte da impressora',
    unreported: 'Não foi possível imprimir. O driver não informou papel nem ribbon',
    failed: 'Não foi possível imprimir',
    'save-failed': 'Não foi possível salvar a montagem',
  } satisfies Record<PrintFailureReason, string>,
  /** The printer line on the laptop and the warning on the TV (DESIGN §10). */
  status: {
    checking: 'Verificando a impressora…',
    ready: 'Impressora pronta',
    offline: 'Impressora desligada',
    'no-paper': 'Impressora sem papel',
    'no-ribbon': 'Impressora sem ribbon',
    paused: 'A fila da impressora está pausada no Windows',
    error: 'A impressora informou um erro',
    'not-found': 'Impressora DS-RX1 não encontrada',
    unknown: 'O driver não informou papel nem ribbon',
  } satisfies Record<PrinterStatus['kind'] | 'checking', string>,
  /** The spooler's or driver's own words, for whoever supports the operator. Laptop only. */
  technicalDetail: (detail: string) => `Detalhe técnico: ${detail}`,
  savedKept: (fileName: string) => `A montagem ${fileName} ficou salva na pasta do evento.`,
} as const

/** `1 Cópia`, `2 Cópias` (RF10). */
export function copiesLabel(copies: number): string {
  return `${copies} ${copies === 1 ? 'Cópia' : 'Cópias'}`
}
