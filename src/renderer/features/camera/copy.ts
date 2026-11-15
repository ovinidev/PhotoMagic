import type { CameraErrorReason } from '@shared/ipc'

/** pt-BR camera messages, shared by the TV surface and the laptop status line. */
export const CAMERA_COPY = {
  starting: 'Abrindo a câmera…',
  retry: 'Tentar novamente',
  errors: {
    'permission-denied': {
      title: 'Sem permissão para usar a câmera',
      detail: 'Libere a câmera em Configurações do Windows › Privacidade › Câmera e toque em Tentar novamente.',
    },
    'not-found': {
      title: 'Nenhuma câmera encontrada',
      detail: 'Conecte a webcam na USB. A imagem aparece sozinha.',
    },
    'in-use': {
      title: 'A câmera está em uso por outro programa',
      detail: 'Feche o outro programa e toque em Tentar novamente.',
    },
    disconnected: {
      title: 'A câmera foi desconectada',
      detail: 'Conecte a webcam de novo. A imagem volta sozinha.',
    },
    unknown: {
      title: 'Não foi possível abrir a câmera',
      detail: 'Toque em Tentar novamente.',
    },
  } satisfies Record<CameraErrorReason, { title: string; detail: string }>,
} as const

/** pt-BR copy of the laptop TV card (RF04). */
export const TV_COPY = {
  heading: 'Tela da TV',
  loading: { title: 'Procurando a TV…', detail: 'Lendo as telas conectadas ao notebook.' },
  readError: { title: 'Não foi possível ler as telas conectadas', detail: 'Feche e abra o Foto Mágica de novo.' },
  found: { title: 'TV encontrada', detail: (size: string) => `${size}, na vertical.` },
  missing: {
    title: 'TV não encontrada',
    detail: 'Conecte a TV na HDMI e use o modo Estender do Windows. Sem a TV, a câmera não abre.',
  },
  landscape: {
    title: 'A TV não está na vertical',
    detail: 'A câmera foi feita para a TV em pé. Gire a tela nas configurações de vídeo do Windows ou abra assim mesmo.',
  },
  open: { title: 'Câmera aberta na TV', detail: (size: string) => `Tela da TV em ${size}.`, action: 'Abrir câmera na TV' },
  detached: {
    missing: { title: 'A TV foi desconectada', detail: 'A tela da câmera volta sozinha quando a TV for conectada de novo.' },
    landscape: {
      title: 'A TV não está mais na vertical',
      detail: 'Gire a tela para retrato nas configurações de vídeo do Windows. A câmera volta sozinha.',
    },
  },
  openAnyway: 'Abrir mesmo assim',
  close: 'Fechar tela da TV',
  actionError: 'Não foi possível mudar a tela da TV. Tente de novo.',
} as const
