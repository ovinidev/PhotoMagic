---
paths:
  - "src/**"
---

# Project structure

Feature-based Electron app. Full layout in [docs/DESIGN.md](../../docs/DESIGN.md#13-folders).

- `src/main/`: main process (windows, IPC, disk, printing, auto-update).
- `src/preload/`: `contextBridge` only. The only bridge from the renderer to Node.
- `src/shared/`: Zod schemas, channel names and pure functions. No React and no Electron. Main, preload and renderer import from here.
- `src/renderer/app/`: routes and shells of the two windows.
- `src/renderer/features/<name>/`: everything for one area, exported through its `index.ts`.
- `src/renderer/shared/`: UI, hooks and screen utils.

Import another feature only through its `index.ts`, never its internals. `src/shared/` and `src/renderer/shared/` never import from `features/` or `app/`. New code lives in the feature that owns the subject. Move it to `src/renderer/shared/` only when a second feature needs it. Pure rules go to `src/shared/`.
