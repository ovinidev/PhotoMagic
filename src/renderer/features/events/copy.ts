import type { EventNameError } from '@shared/files'
import type { EventStartError } from '@shared/ipc'
import type { PrintMode } from '@shared/layout'

/** pt-BR copy of the create-event screen (PRD §6.1). */
export const EVENTS_COPY = {
  title: 'Novo evento',
  studio: 'Foto Mágica',
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
  templateDefault: 'Fundo branco (padrão) · 1844 × 1240 px',
  templateDefaultHint: 'Sem template, a montagem usa fundo branco com as fotos nas posições padrão. Importe um PNG ou JPG de 1844 × 1240 px para trocar o fundo.',
  templateDefaultAlt: (mode: string) => `Fundo branco padrão do modo ${mode}, com as posições das fotos`,
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
    pdf: 'Este arquivo é um PDF. Exporte o template como PNG ou JPG de 1844 × 1240 px e importe de novo.',
  },
  editLayout: (mode: string) => `Editar posições das fotos (${mode})`,
  tv: 'Tela da TV',
  start: 'Iniciar evento',
  starting: 'Iniciando…',
  startErrors: {
    'invalid-name': 'Confira o nome do evento.',
    missing: 'A TV não foi encontrada. Conecte a TV e tente de novo.',
    landscape: 'A TV não está na vertical. Gire a tela para retrato nas configurações de vídeo do Windows.',
    'folder-failed': 'Não foi possível criar a pasta na Área de Trabalho.',
    'already-open': 'Já existe um evento aberto.',
  } satisfies Record<EventStartError, string>,
  startFailed: 'Não foi possível iniciar o evento. Tente de novo.',
  /** Under a disabled `Iniciar evento`: the first thing still missing. */
  blocked: {
    name: 'Digite o nome do evento para começar.',
    template: 'Importe um template de 1844 × 1240 px para começar.',
    tv: 'Conecte a TV na vertical para começar.',
  },
} as const
