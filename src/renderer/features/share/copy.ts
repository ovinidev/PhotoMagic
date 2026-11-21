import type { ShareState } from '@shared/ipc'

/** pt-BR copy of the offline photo download (DESIGN §17). */
export const SHARE_COPY = {
  panelTitle: 'Baixe sua foto no celular',
  stepWifi: '1. Conecte-se ao Wi-Fi',
  stepScan: (step: number) => `${step}. Escaneie para baixar`,
  wifiAlt: (ssid: string) => `QR code para entrar no Wi-Fi ${ssid}`,
  linkAlt: 'QR code para baixar a foto',
  noInternet: 'Rede local da festa, sem internet',
  gallery: {
    title: 'Galeria do evento no celular',
    caption: 'Escaneie para ver e baixar todas as fotos desta festa',
    alt: 'QR code da galeria do evento',
    wifiTitle: 'Wi-Fi da festa',
    wifiAlt: (ssid: string) => `QR code para entrar no Wi-Fi ${ssid}`,
  },
  loading: 'Carregando…',
  loadError: 'Não foi possível carregar as configurações da foto no celular',
  settings: {
    title: 'Foto no celular',
    description: 'Os convidados baixam a montagem pelo Wi-Fi da festa, sem internet.',
    enabled: 'Mostrar QR code para baixar a foto',
    port: 'Porta',
    host: 'Endereço do notebook',
    hostHint: 'Deixe vazio para detectar. Hotspot do Windows: 192.168.137.1',
    ssid: 'Nome do Wi-Fi (SSID)',
    password: 'Senha do Wi-Fi',
    security: 'Segurança',
    securities: { WPA: 'WPA/WPA2', WEP: 'WEP', nopass: 'Sem senha' },
    hidden: 'Rede oculta',
    open: 'Configurar',
    close: 'Fechar',
    save: 'Salvar',
    saved: 'Salvo',
    invalid: 'Confira a porta (1024 a 65535) e o endereço (ex.: 192.168.137.1)',
  },
  status: (state: ShareState): string => {
    if (state.status === 'off') return 'Desligado'
    if (state.status === 'running') return `Ativo em http://${state.host}:${state.port}`
    if (state.error === 'no-address') return 'Sem rede local. Ligue o hotspot ou conecte ao roteador'
    if (state.error === 'port-in-use') return `A porta ${state.port} já está em uso`
    return 'Não foi possível iniciar'
  },
} as const
