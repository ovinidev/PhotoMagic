import type { WebcamControlId } from '@shared/webcam'

/** pt-BR copy of the webcam adjustments panel (PRD §6.7). */
export const WEBCAM_COPY = {
  title: 'Ajustes da webcam',
  open: 'Ajustes da webcam',
  close: 'Fechar',
  loading: 'Carregando os ajustes…',
  error: 'Não foi possível ler os ajustes da webcam.',
  saveError: 'Não foi possível salvar o ajuste.',
  empty: 'Esta câmera não oferece ajustes de imagem.',
  noneSaved: 'Nenhum ajuste salvo. Os controles aparecem quando a câmera abrir na TV.',
  offline: 'A câmera não está aberta. Os ajustes ficam salvos e são aplicados quando ela abrir.',
  whiteBalance: 'Balanço de branco',
  whiteBalanceModes: { continuous: 'Automático', manual: 'Manual' },
  controls: {
    brightness: 'Brilho',
    contrast: 'Contraste',
    saturation: 'Saturação',
    sharpness: 'Nitidez',
    colorTemperature: 'Temperatura de cor',
    gain: 'Ganho',
    backlightCompensation: 'Compensação de luz de fundo',
  } satisfies Record<WebcamControlId, string>,
} as const
