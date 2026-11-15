import type { EventNameError } from '@shared/files'
import type { EventStartError } from '@shared/ipc'
import type { PrintMode } from '@shared/layout'

/** pt-BR copy of the create-event screen (PRD §6.1). */
export const EVENTS_COPY = {
  title: 'Novo evento',
  name: 'Nome do evento',
  namePlaceholder: 'Aniversário AJ',
  folderHint: (name: string) => `As montagens ficam na Área de Trabalho, na pasta ${name}.`,
  folderHintEmpty: 'O nome também é o nome da pasta na Área de Trabalho.',
  nameErrors: {
    empty: 'Digite o nome do evento.',
    'invalid-character': 'O nome não pode ter \\ / : * ? " < > |',
    reserved: 'Esse nome é reservado pelo Windows. Escolha outro.',
    'trailing-dot-or-space': 'O nome não pode terminar com ponto.',
    'too-long': 'Use no máximo 80 caracteres.',
  } satisfies Record<EventNameError, string>,
  mode: 'Modo',
  modes: {
    'two-strips': { label: '2 tiras', detail: 'Corte de 2" ligado. Cinco fotos, duas tiras.' },
    'one-strip': { label: '1 tira', detail: 'Folha inteira, sem corte. Três fotos.' },
  } satisfies Record<PrintMode, { label: string; detail: string }>,
  template: (mode: string) => `Template do modo ${mode}`,
  templateEmpty: (mode: string) => `Nenhum template para ${mode}. Importe um PNG ou JPG de 1844 × 1240 px.`,
  templateImport: 'Importar template',
  templateReplace: 'Trocar template',
  templateLoading: 'Lendo o template…',
  templatesLoading: 'Carregando templates…',
  templatesError: 'Não foi possível ler os templates salvos.',
  templatePreviewAlt: (mode: string) => `Template do modo ${mode}`,
  templateErrors: {
    size: (width: number, height: number) => `O arquivo tem ${width} × ${height} px. O template precisa ter 1844 × 1240 px.`,
    format: 'Use um arquivo PNG ou JPG.',
    unreadable: 'Não foi possível ler o arquivo.',
  },
  tv: 'Tela da TV',
  landscapeConfirm: 'Abrir a câmera na TV mesmo na horizontal',
  start: 'Iniciar evento',
  starting: 'Iniciando…',
  startErrors: {
    'invalid-name': 'Confira o nome do evento.',
    'no-template': 'Importe o template deste modo antes de iniciar.',
    missing: 'A TV não foi encontrada. Conecte a TV e tente de novo.',
    landscape: 'A TV não está na vertical. Confirme para abrir assim mesmo.',
    'folder-failed': 'Não foi possível criar a pasta na Área de Trabalho.',
    'already-open': 'Já existe um evento aberto.',
  } satisfies Record<EventStartError, string>,
  startFailed: 'Não foi possível iniciar o evento. Tente de novo.',
} as const
