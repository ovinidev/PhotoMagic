import type { PrintFailureReason, PrinterStatus } from '@shared/ipc'
import type { PrintMode } from '@shared/layout'
import type { PrinterSettings } from '@shared/printerSettings'

/** pt-BR copy of printing, on the TV and on the laptop (PRD §6.5, DESIGN §10). */
export const PRINT_COPY = {
  print: 'Imprimir',
  cancel: 'Cancelar',
  more: 'Mais',
  less: 'Menos',
  again: 'Imprimir novamente',
  newRound: 'Nova rodada',
  retry: 'Tentar novamente',
  /** The TV status line for each real job stage (DESIGN §14). */
  stage: {
    saving: 'Preparando sua foto…',
    sending: 'Imprimindo…',
    done: 'Sua foto está pronta!',
  },
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
  /** Under a print failure on the TV: the montage is safe; the file name stays on the laptop. */
  savedKept: 'Sua foto está guardada.',
} as const

/** `1 Cópia`, `2 Cópias` (RF10). */
export function copiesLabel(copies: number): string {
  return `${copies} ${copies === 1 ? 'Cópia' : 'Cópias'}`
}

/** pt-BR copy of the printer screen (DESIGN §10). */
export const PRINTER_SETTINGS_COPY = {
  title: 'Impressora',
  open: 'Configurar',
  loading: 'Carregando a impressora…',
  loadError: 'Não foi possível ler a configuração da impressora.',
  description: 'O app imprime na DS-RX1 com papel 6x4 deitado, sem girar nem esticar a foto. Aqui você escolhe o corte de 2" e o que fica salvo no Windows.',
  summary: (settings: PrinterSettings) =>
    `Corte de 2": ${settings.cut['two-strips'] ? 'ligado' : 'desligado'} em 2 tiras, ${settings.cut['one-strip'] ? 'ligado' : 'desligado'} em 1 tira`,
  cutLegend: 'Corte de 2"',
  cut: (mode: PrintMode) => `Cortar em 2 tiras no modo ${mode === 'two-strips' ? '2 tiras' : '1 tira'}`,
  cutHint: {
    'two-strips': 'Padrão: ligado. A folha sai cortada nas duas tiras.',
    'one-strip': 'Padrão: desligado. A folha sai inteira.',
  } satisfies Record<PrintMode, string>,
  windowsLegend: 'Preferências do Windows',
  restore: 'Voltar as preferências do Windows depois de cada impressão',
  restoreHint: 'Ligado: outros programas do notebook continuam imprimindo como antes. Desligado: o papel e o corte da última impressão ficam salvos na impressora.',
  readTitle: 'O que está salvo na impressora agora',
  read: 'Ler impressora',
  reading: 'Lendo…',
  readHint: 'Só lê. Não imprime nem muda nada.',
  readError: 'Não foi possível ler a impressora.',
  queue: 'Impressora',
  noQueue: 'Nenhuma DS-RX1 encontrada',
  paper: 'Papel',
  orientation: 'Orientação',
  savedCut: 'Corte de 2"',
  saved: 'Salvo. Vale a partir da próxima impressão.',
  saveError: 'Não foi possível salvar.',
  close: 'Fechar',
} as const

