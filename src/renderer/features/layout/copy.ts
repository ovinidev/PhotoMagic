import type { PrintMode } from '@shared/layout'

const SLOT_LABELS: Record<string, string> = {
  'top-1': 'Cima 1',
  'top-2': 'Cima 2',
  'top-3': 'Cima 3',
  'bottom-1': 'Baixo 1',
  'bottom-2': 'Baixo 2',
  'photo-1': 'Foto 1',
  'photo-2': 'Foto 2',
  'photo-3': 'Foto 3',
}

/** pt-BR copy of the slot editor (PRD §6.2). Cima/Baixo are the editor's slot labels. */
export const LAYOUT_COPY = {
  title: 'Posições das fotos',
  subtitle: 'Arraste os quadros cinza e os cartões 1, 2 e 3 para os quadros do template. Alt desliga o encaixe.',
  open: 'Editar posições das fotos',
  modes: { 'two-strips': '2 tiras', 'one-strip': '1 tira' } satisfies Record<PrintMode, string>,
  modeSelector: 'Layout',
  undo: 'Desfazer',
  redo: 'Refazer',
  reset: 'Restaurar padrão',
  done: 'Concluir',
  columns: { slot: 'Quadro', photo: 'Imagem', left: 'Left', top: 'Top', width: 'Width', height: 'Height', angle: 'Angle' },
  photoNone: 'Nenhuma',
  slotLabel: (id: string) => SLOT_LABELS[id] ?? id,
  /** A card's label, or `Quadro cinza Cima 1` for a fixed box (`box:top-1`). */
  itemLabel: (id: string) => (id.startsWith('box:') ? `Quadro cinza ${SLOT_LABELS[id.slice(4)] ?? id.slice(4)}` : (SLOT_LABELS[id] ?? id)),
  boxLabel: (slot: string) => `Quadro cinza ${slot}`,
  cardsHeading: 'Fotos (cartões coloridos)',
  boxesHeading: 'Quadros cinza fixos',
  boxesHint: 'Cada foto é cortada no seu quadro cinza. Arraste-os para os quadros do template.',
  editTarget: 'Mover',
  targets: { cards: 'Fotos', boxes: 'Quadros cinza' },
  cardLabel: (slot: string, photo: number | null) => (photo === null ? `${slot}, sem foto` : `${slot}, foto ${photo}`),
  fieldLabel: (column: string, slot: string) => `${column} de ${slot}`,
  rotate: 'Girar',
  cutLine: 'Linha de corte',
  cutWarning: (slots: string[]) =>
    `${slots.join(', ')} ${slots.length === 1 ? 'cruza' : 'cruzam'} a linha de corte (y = 620). A tira pode sair cortada no meio da foto.`,
  canvasZoom: 'Zoom da folha',
  canvasZoomHint: 'Ctrl + roda do mouse para aproximar; arraste o fundo para mover.',
  noTemplate: (mode: string) => `Sem template para ${mode}: fundo branco. As caixas cinza são as posições padrão.`,
  templateAlt: (mode: string) => `Template do modo ${mode}`,
  loading: 'Carregando posições…',
  loadError: 'Não foi possível ler as posições salvas.',
  saving: 'Salvando…',
  saved: 'Salvo',
  saveError: 'Não foi possível salvar as posições.',
  eventOpen: 'Encerre o evento para mudar as posições.',
} as const
