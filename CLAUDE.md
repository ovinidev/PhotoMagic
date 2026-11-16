# CLAUDE.md

Foto Mágica 2.0 is a party photobooth: vertical touch TV, webcam on top, operator laptop and a DNP DS-RX1 printer. What the product does is in [docs/PRD.md](docs/PRD.md). How to build it is in [docs/DESIGN.md](docs/DESIGN.md). If the code disagrees with the docs, stop and ask. If you change a rule, update the doc in the same PR.

This file is the agent guide. In [PilatePay](https://github.com/ovinidev/PilatePay) the equivalent is `AGENTS.md`. This repo's folder structure follows that one, read on 2026-11-14, with the addition of `src/main` and `src/preload` because here the app is Electron. PilatePay uses ESLint; here the linter is oxlint, by decision of this project.

The foundation scaffold (shell windows, typed IPC, tooling, CI) is in place, plus the dual windows (TV monitor choice and hot-plug), the live camera on the TV, create event (name, mode, per-mode template), the capture round, the montage, the print screen with the simulated printer, printer status and DS-RX1 printing through the Windows PowerShell PrintTicket helper (DESIGN §10; still to be confirmed on the device), the slot editor for both layouts, round framing (RF09), the gallery (RF14), webcam adjustments (RF15) with the TV top bar and thirds grid, the app icon (`assets/brand/icon.ico`, rebuilt with `pnpm icon`), the laptop app zoom and window-sized UI, the editor sheet zoom and pan, the TV two-finger close hold with `Abrir TV` on the laptop (DESIGN §3, §7), and build, release and auto-update (RNF09: NSIS installer `FotoMagica-Setup.exe`, GitHub Release on a new version, background electron-updater gated on no event and a network, see DESIGN §11 and §12). Not built yet: the camera choice in create-event when there are several cameras and no MX Brio. The commands below are the contract. Do not invent another package manager, another linter or another E2E runner.

## Language and tooling rules (read first)

- **Language.** Code, identifiers, comments, commit messages, branch names, PR titles and descriptions, and documentation are all in **English**. The only exception is end-user UI strings (everything the operator or guests see on screen), which are **pt-BR**.
- **Tooling.** All coding for this project is done with the **Claude Code CLI**. **Never use Grok models.**

## Stack

- Electron + React + strict TypeScript, Windows 10/11
- Vite via electron-vite (main, preload and renderer)
- Tailwind CSS + shadcn/ui on the laptop; the TV is designed separately (DESIGN §14)
- Zod on every IPC payload
- Vitest + Testing Library; Playwright on Electron (`_electron.launch`)
- oxlint. No ESLint, no `eslint.config.js`, no `eslint` dependency
- pnpm. No npm, yarn, or `package-lock.json`
- Node `>=22`, `packageManager` field in `package.json`
- Husky with a `pre-push` hook (oxlint, typecheck, unit tests and Playwright), in `.husky/pre-push`

## Language details

- Code, identifiers, comments, test names, commit messages, branch names, PR titles and descriptions: English
- Product docs (`CLAUDE.md`, `docs/`): English
- End-user UI strings (all text a person sees in the app, e.g. button labels and messages): pt-BR, quoted verbatim in the docs
- PilatePay also writes docs in English; this repo now matches

## Commands

```bash
pnpm dev                 # electron-vite dev
pnpm typecheck           # tsc --noEmit on tsconfig.node, tsconfig.web and tsconfig.e2e
pnpm lint                # oxlint --deny-warnings .
pnpm test                # vitest run
pnpm test:coverage       # vitest run --coverage
pnpm exec vitest run <file> --reporter=dot
pnpm test:e2e            # playwright test, against Electron (global setup runs electron-vite build)
pnpm exec playwright test <spec> --reporter=dot
pnpm build               # electron-vite build
pnpm dist                # build + electron-builder --win
```

While iterating, run only the tests or specs you touched, with summarized output:

```bash
pnpm vitest run <files> --reporter=dot
pnpm playwright test <specs> --reporter=dot
```

Do not run the full lint, build, unit or Playwright suite yourself. The Husky `pre-push` hook runs oxlint, typecheck, unit tests and Playwright; GitHub Actions runs the same contract (DESIGN §12). On Linux without a display the hook wraps Playwright in `xvfb-run`. Tail only failures; never paste long test or build logs.

E2E does not use the webcam or the DS-RX1. It starts with `FOTOMAGICA_E2E=1` and `FOTOMAGICA_PRINTER=simulated`. The camera is Chromium's fake device (`FOTOMAGICA_FAKE_CAMERA`: unset for its pattern, a `.y4m` path, or `none`) the monitors are a fixture (`FOTOMAGICA_DISPLAYS`: `portrait-tv`, `landscape-tv`, `laptop-only`), and each test gets its own `FOTOMAGICA_USER_DATA` and `FOTOMAGICA_DESKTOP` folders. `FOTOMAGICA_PRINTER_STATUS` (`offline`, `no-paper`, `no-ribbon`) and `FOTOMAGICA_PRINTER_CUT=unsupported` drive simulated print failures. See DESIGN §3, §5, §10 and §12.

## Releasing a version

The release is driven by the `package.json` version (DESIGN §12). Nothing is published by hand.

1. On a branch, bump the version: `pnpm version minor --no-git-tag-version` (or `patch` / `major`). It changes `package.json` only; do not create a tag, the release job creates `v<version>`.
2. Commit (`Release 0.2.0`), push, open a PR. CI runs the checks.
3. Merge to `main`. `release.yml` runs the checks again, builds `FotoMagica-Setup.exe` on `windows-latest`, uploads it as an artifact and, because `v<version>` does not exist yet, publishes a GitHub Release with `FotoMagica-Setup.exe`, its `.blockmap` and `latest.yml`.
4. Installed apps pick it up at their next startup with a network and no event, download in the background and install when the operator quits.
5. The stable download address is `https://github.com/ovinidev/PhotoMagic/releases/latest/download/FotoMagica-Setup.exe`.

A merge without a bump only produces the workflow artifact. Never delete or re-upload assets of a published release: installed apps compare against its `latest.yml`. To sign, set the repository secrets `CSC_LINK` (base64 `.pfx`) and `CSC_KEY_PASSWORD`; without them the installer is unsigned and the job stays green. Update errors on a machine are in `%APPDATA%\Foto Mágica\logs\updater.log`.

## Folders

Feature-based, like PilatePay. Detail and tree in [docs/DESIGN.md](docs/DESIGN.md) §13.

- `src/main/`: main process. Windows, IPC, disk, printing, auto-update
- `src/preload/`: `contextBridge`. The only bridge from the renderer to Node
- `src/shared/`: Zod schemas, channel names and pure functions. No React and no Electron. Main, preload and renderer import from here
- `src/renderer/app/`: routes and shells of the two windows
- `src/renderer/features/<name>/`: one area, exported only through `index.ts`
- `src/renderer/shared/`: ui, hooks and screen utils. Does not import a feature or `app`
- `e2e/`: Playwright. One spec per flow, not per implementation file. `fixtures.ts` launches the built app with the E2E env
- `docs/`: PRD, DESIGN, briefing figures
- `assets/brand/`: transparent logo, symbol and icon

A feature imports `src/renderer/shared/`, `src/shared/` and another feature's `index.ts`. Never its internals. New code is born in the feature that owns the subject. It only moves to `src/renderer/shared/` when a second feature needs it. Pure rules go to `src/shared/`.

Tests of pure rules sit next to the file (`snap.test.ts`).

## Conventions

- `contextIsolation: true`, `nodeIntegration: false`, `sandbox: true`. No `remote`, no `window.require`
- Every IPC channel has a stable name, a Zod schema and a type in the preload. The renderer does not build channel strings by hand
- Pure business rules (snap, crop, file name, monitor choice, space geometry) do not import Electron or React. This way Vitest covers them without opening a window
- Laptop UI uses a shadcn component from `shared/components/ui/` before creating another. The TV is not a shadcn dialog with another theme: it is the camera surface, drawn in `features/camera`
- Visible text in pt-BR, with the PRD labels (`Iniciar evento`, `Encerrar evento`, `Imprimir`, `Cancelar`, `Mais`, `Menos`, `Nova rodada`, `Imprimir novamente`)
- Laptop button, checkbox and select carry `cursor-pointer` and a touch target of at least 44 px. On the TV the minimum is 64 px

## Easy-to-break rules

- The event folder is `app.getPath('desktop') + '\\' + name`. Only the `HH-mm-ss.jpg` montage goes inside it. No original photo, no template, no JSON
- The Logitech is mounted horizontally. The saved photo is the image the person saw. Preview and file use the same function: rotate by `CAMERA_ROTATION_DEG` (initial 90) and then mirror horizontally. No second "similar" path, and no rotating the camera in hardware
- There are two saved layouts, editable and independent. The 2-strip one has 5 slots: top 1, 2 and 3 with Angle 270, bottom 1 and 2 with Angle 0. The 1-strip one has 3 slots, photos 1, 2 and 3, covering the whole sheet, with no cut. The event uses the layout of the mode chosen before starting. The position does not change per event; the background does
- The briefing table is approximate and only applies to the 2-strip layout. Cima 3 with Angle 0 and Top 194 is a leftover of the demonstration. The 2-strip seed is the client's measured artwork: the photo boxes are always in those positions (PRD §6.2), only the background changes, and photos are clipped to the boxes' rounded corners. The cut line y = 620 sits in the gap between the strips and is still to be confirmed on a test sheet. The 1-strip seed is still pending validation
- In horizontal slots the default fit is `cover` with zero pan, which crops the center of the portrait. The operator adjusts each slot of the round (move, rotate, zoom) without recapturing
- The 2-inch cut turns on in 2-strip mode and off in 1-strip mode. The 1-strip mode fills the 1844×1240 sheet with the three photos. Do not leave half blank and do not ask for 6×2 paper. Only `src/main/print/` talks to the driver. The simulated mode exists since the first PR that prints
- Silent printing, on the DS-RX1, with no Windows dialog
- If the webcam or the printer drops mid-round, the round stays in memory. The TV window keeps responding
- The home screen only creates an event. It does not list old events
- No network at the event. Auto-update does not run with an event open and does not hold up startup when offline
- The Windows build signs if `CSC_LINK` and `CSC_KEY_PASSWORD` exist. Without those secrets the installer comes out unsigned and the job stays green
- The accepted template is exactly 1844×1240 px. The montage too. DPI 300
- The file name uses Windows local time, 24 h, hyphens: `21-45-08.jpg`. Two files in the same second get `-2`, `-3`
- Dragging or rotating a slot in the editor does not write to disk and does not call IPC. The Left/Top/Angle panel updates in the same frame. The write happens on release. Snap to edges and centers applies during the gesture; rotation snaps to 0°, 90°, 180° and 270°. Alt turns snap off
- More copies stops at 10. The GitHub Release only goes out when the `package.json` version has not been published yet

## What not to do

- Do not create an account, backend, cloud gallery or save the three loose photos
- Do not reopen the print dialog "just this once"
- Do not hardcode the monitor index. The TV is chosen by the `screen` API
- Do not treat the demo numbers, or the 1-strip seed, as the measurement of an approved artwork
- Do not call the driver from a React component
- Do not add ESLint next to oxlint
- Do not make a phone layout. The laptop is the main window; the TV is 1080×1920 in portrait
- Do not put the logo over the live image
- Do not let the TV see the file system
- Do not implement video, portrait mode, front camera or the current app's settings screen
- Do not write the round to disk "for safety" before print. Until print, the round is memory. If the process dies before that, the round is lost; that is the rule
