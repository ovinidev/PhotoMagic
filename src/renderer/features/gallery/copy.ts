/** pt-BR copy of the gallery, on the TV and on the laptop (PRD §6.6). */
export const GALLERY_COPY = {
  title: 'Galeria',
  open: 'Abrir a galeria',
  close: 'Fechar',
  back: 'Voltar',
  empty: 'Nenhuma montagem ainda',
  loading: 'Carregando a galeria…',
  error: 'Não foi possível ler a galeria.',
  imageError: 'Não foi possível abrir esta montagem.',
  menu: 'Mais opções',
  again: 'Imprimir novamente',
  sending: 'Enviando para a impressora…',
  sent: 'Montagem enviada para a impressora',
  missing: 'Esta montagem não está mais na pasta do evento.',
  thumbAlt: (fileName: string) => `Montagem ${fileName}`,
  openItem: (fileName: string) => `Abrir a montagem ${fileName}`,
} as const
