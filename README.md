# PhotoMagic

Foto Mágica 2.0: desktop photobooth app for parties (Electron + React + TypeScript), offline, with direct printing on the DNP DS-RX1.

- [CLAUDE.md](CLAUDE.md): rules for whoever implements it
- [docs/PRD.md](docs/PRD.md): product, flow and requirements
- [docs/DESIGN.md](docs/DESIGN.md): technical and visual design

Documentation is in English. End-user UI strings stay in pt-BR.

## Status

Foundation scaffold: operator window, placeholder TV window helper, typed IPC (`app:get-version`), design tokens, tests, CI and the Windows installer pipeline. Product features (events, editor, capture, printing, gallery) come next; their PRD scenarios are `test.fixme` in `e2e/`.

## Requirements

- Node `>= 22`
- pnpm (the version pinned in `package.json` → `packageManager`; `corepack enable` picks it up)
- Windows 10/11 for production. Development and CI checks also run on Linux

## Getting started

```bash
pnpm install          # also installs the Husky pre-push hook
pnpm dev              # electron-vite dev, with hot reload in the renderer
```

## Scripts

| Command | What it does |
| --- | --- |
| `pnpm dev` | Runs the app in development |
| `pnpm typecheck` | `tsc --noEmit` on the node, web and e2e projects |
| `pnpm lint` | oxlint, warnings fail |
| `pnpm test` | Vitest (pure rules in node, renderer components in jsdom) |
| `pnpm test:coverage` | Vitest with v8 coverage |
| `pnpm test:e2e` | Builds the app and runs Playwright against Electron |
| `pnpm build` | electron-vite build into `out/` |
| `pnpm dist` | Build plus the Windows NSIS installer in `release/` |

While iterating, run only what you touched:

```bash
pnpm vitest run <files> --reporter=dot
pnpm playwright test <specs> --reporter=dot
```

E2E never uses the webcam or the DS-RX1: the fixture starts the app with `FOTOMAGICA_E2E=1` and `FOTOMAGICA_PRINTER=simulated`. On a Linux machine without a display, wrap it: `xvfb-run -a pnpm test:e2e`.

## Layout

```
src/main/        main process: windows, IPC handlers, updater
src/preload/     contextBridge, the only bridge to Node (window.fotomagica)
src/shared/      Zod schemas, channel names, constants, pure rules (no React, no Electron)
src/renderer/    operator.html and guest.html; app/ shells, features/<name>/, shared/
e2e/             Playwright specs, one per flow
assets/brand/    logo, symbol and icon
```

Details in [docs/DESIGN.md §13](docs/DESIGN.md#13-folders).

## CI and releases

- `.github/workflows/ci.yml`: typecheck, oxlint, unit tests with coverage and E2E once per pull request, when it is opened or reopened; docs-only PRs skip it. Later pushes are checked by the Husky `pre-push` hook.
- `.github/workflows/release.yml`: on push to `main`, `pnpm typecheck` and `pnpm test` on the merged code, then `pnpm dist` on `windows-latest`. The installer is always uploaded as an artifact; a GitHub Release `v<version>` is published only when that `package.json` version has not been released yet.
- Code signing is optional: set the `CSC_LINK` (base64 `.pfx`) and `CSC_KEY_PASSWORD` repository secrets to sign. Without them the installer is unsigned and the job stays green.

The latest installer: <https://github.com/ovinidev/PhotoMagic/releases/latest/download/FotoMagica-Setup.exe>
