# CLAUDE.md

Foto Mágica 2.0 é um photobooth de festa: TV vertical touch, webcam no topo, notebook do operador e impressora DNP DS-RX1. O que o produto faz está em [docs/PRD.md](docs/PRD.md). Como construir está em [docs/DESIGN.md](docs/DESIGN.md). Se o código discordar dos docs, pare e pergunte. Se mudar uma regra, atualize o doc no mesmo PR.

Este arquivo é o guia de agentes. No [PilatePay](https://github.com/ovinidev/PilatePay) o equivalente é `AGENTS.md`. A estrutura de pastas deste repo segue a de lá, lida em 2026-11-14, com o acréscimo de `src/main` e `src/preload` porque aqui o app é Electron. O PilatePay usa ESLint; aqui o linter é o oxlint, por decisão deste projeto.

Este repositório ainda não tem o app. Os comandos abaixo são o contrato da primeira implementação. Não invente outro gerenciador de pacotes, outro linter nem outro runner de E2E.

## Stack

- Electron + React + TypeScript estrito, Windows 10/11
- Vite via electron-vite (main, preload e renderer)
- Tailwind CSS + shadcn/ui no notebook; a TV é desenhada à parte (DESIGN §14)
- Zod em todo payload de IPC
- Vitest + Testing Library; Playwright no Electron (`_electron.launch`)
- oxlint. Sem ESLint, sem `eslint.config.js`, sem dependência `eslint`
- pnpm. Sem npm, yarn, ou `package-lock.json`
- Node `>=22`, campo `packageManager` no `package.json`

## Idioma

- Código, identificadores, comentários, nomes de teste e mensagens de commit: inglês
- Docs de produto (`CLAUDE.md`, `docs/`) e todo texto que a pessoa vê: pt-BR
- O PilatePay escreve docs em inglês. Aqui os docs ficam em português de propósito

## Comandos

```bash
pnpm dev                 # electron-vite dev
pnpm typecheck           # tsc --noEmit
pnpm lint                # oxlint .
pnpm test                # vitest run
pnpm test:coverage       # vitest run --coverage
pnpm exec vitest run <file> --reporter=dot
pnpm test:e2e            # playwright test, contra o Electron
pnpm exec playwright test <spec> --reporter=dot
pnpm build               # electron-vite build
pnpm dist                # build + electron-builder --win
```

Enquanto itera, rode só o teste do arquivo que mexeu, com saída curta, e reporte falha. Não rode a suíte inteira a cada tentativa. Lint, typecheck, unitário e E2E entram no hook husky `pre-push` e no GitHub Actions (DESIGN §12).

O E2E não usa a webcam nem a DS-RX1. Ele sobe com `FOTOMAGICA_E2E=1` e `FOTOMAGICA_PRINTER=simulated`.

## Pastas

Feature-based, como o PilatePay. Detalhe e árvore em [docs/DESIGN.md](docs/DESIGN.md) §13.

- `src/main/`: processo principal. Janelas, IPC, disco, impressão, auto-update
- `src/preload/`: `contextBridge`. Única ponte do renderer para o Node
- `src/shared/`: schemas Zod, nomes de canal e funções puras. Sem React e sem Electron. Main, preload e renderer importam daqui
- `src/renderer/app/`: rotas e cascas das duas janelas
- `src/renderer/features/<nome>/`: uma área, exportada só pelo `index.ts`
- `src/renderer/shared/`: ui, hooks e utils de tela. Não importa feature nem `app`
- `e2e/`: Playwright. Um spec por fluxo, não por arquivo de implementação
- `docs/`: PRD, DESIGN, figuras do briefing
- `assets/brand/`: logo transparente, símbolo e ícone

Uma feature importa `src/renderer/shared/`, `src/shared/` e o `index.ts` de outra feature. Nunca o miolo dela. Código novo nasce na feature dona do assunto. Só vai para `src/renderer/shared/` quando uma segunda feature precisa. Regra pura vai para `src/shared/`.

Teste de regra pura fica ao lado do arquivo (`snap.test.ts`).

## Convenções

- `contextIsolation: true`, `nodeIntegration: false`, `sandbox: true`. Sem `remote`, sem `window.require`
- Todo canal de IPC tem nome estável, schema Zod e tipo no preload. O renderer não monta string de canal na mão
- Regra de negócio pura (snap, corte, nome de arquivo, escolha do monitor, geometria do espaço) não importa Electron nem React. Assim o Vitest cobre sem subir janela
- UI do notebook usa componente shadcn de `shared/components/ui/` antes de criar outro. A TV não é um diálogo shadcn com outro tema: é a superfície da câmera, desenhada em `features/camera`
- Texto visível em pt-BR, com os rótulos do PRD (`Iniciar evento`, `Encerrar evento`, `Imprimir`, `Cancelar`, `Mais`, `Menos`, `Nova rodada`, `Imprimir novamente`)
- Botão, checkbox e select do notebook levam `cursor-pointer` e alvo de toque de pelo menos 44 px. Na TV o mínimo é 64 px

## Regras fáceis de quebrar

- A pasta do evento é `app.getPath('desktop') + '\\' + nome`. Dentro dela só entra a montagem `HH-mm-ss.jpg`. Nem foto original, nem template, nem JSON
- A Logitech fica montada na horizontal. A foto salva é a imagem que a pessoa viu. Preview e arquivo usam a mesma função: girar `CAMERA_ROTATION_DEG` (inicial 90) e depois espelhar na horizontal. Sem segundo caminho “parecido”, e sem girar a câmera no hardware
- Há dois layouts salvos, editáveis e independentes. O de 2 tiras tem 5 espaços: cima 1, 2 e 3 com Angle 270, baixo 1 e 2 com Angle 0. O de 1 tira tem 3 espaços, fotos 1, 2 e 3, cobrindo a folha inteira, sem corte. O evento usa o layout do modo escolhido antes de iniciar. A posição não muda por evento; o fundo muda
- A tabela do briefing é aproximada e vale só para o layout de 2 tiras. O Cima 3 com Angle 0 e Top 194 é sobra da demonstração. Os espaços ficam dentro dos quadrados cinzas e não se sobrepõem. Baixo 1 e Baixo 2 com Left 72 e 403 e largura 500 se cruzam: o seed já separa o de baixo. As medidas dos quadrados e a linha de corte (y = 620) estão pendentes do cliente. O seed de 1 tira também está pendente de validação
- Nos espaços horizontais o encaixe padrão é `cover` com pan zero, o que corta o centro do retrato. O operador ajusta cada espaço da rodada (mover, girar, zoom) sem recapturar
- O corte de 2 polegadas liga no modo 2 tiras e desliga no modo 1 tira. O modo 1 tira preenche a folha 1844×1240 com as três fotos. Não deixe metade em branco e não peça papel 6×2. Quem fala com o driver é só `src/main/print/`. O modo simulado existe desde o primeiro PR que imprimir
- Impressão silenciosa, na DS-RX1, sem diálogo do Windows
- Se a webcam ou a impressora cair no meio da rodada, a rodada fica na memória. A janela da TV continua respondendo
- A tela inicial só cria evento. Não lista eventos antigos
- Sem rede no evento. O auto-update não roda com evento aberto e não segura a abertura quando estiver offline
- O build do Windows assina se `CSC_LINK` e `CSC_KEY_PASSWORD` existirem. Sem esses secrets o instalador sai sem assinatura e o job continua verde
- O template aceito tem exatamente 1844×1240 px. A montagem também. DPI 300
- O nome do arquivo usa a hora local do Windows, 24 h, hífens: `21-45-08.jpg`. Dois arquivos no mesmo segundo ganham `-2`, `-3`
- Arrastar ou girar um espaço no editor não grava disco e não chama IPC. O painel Left/Top/Angle atualiza no mesmo frame. A gravação é no soltar. O snap de bordas e centros vale no gesto; o giro encosta em 0°, 90°, 180° e 270°. Alt desliga o snap
- Mais cópias para em 10. A GitHub Release só sai quando a versão do `package.json` ainda não foi publicada

## O que não fazer

- Não criar conta, backend, galeria na nuvem nem salvar as três fotos soltas
- Não reabrir o diálogo de impressão “só desta vez”
- Não fixar o índice do monitor. A TV é escolhida pela API `screen`
- Não tratar os números da demo, nem o seed de 1 tira, como medida de uma arte já aprovada
- Não chamar o driver a partir de um componente React
- Não acrescentar ESLint ao lado do oxlint
- Não fazer layout de celular. O notebook é a janela principal; a TV é 1080×1920 em retrato
- Não colocar a logo por cima da imagem ao vivo
- Não deixar a TV enxergar o sistema de arquivos
- Não implementar vídeo, modo retrato, câmera frontal nem a tela de configurações do app atual
- Não escrever a rodada em disco “por segurança” antes do imprimir. Até imprimir, a rodada é memória. Cair o processo antes disso perde a rodada; é a regra
