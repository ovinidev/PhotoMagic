---
paths:
  - "**/*.test.ts"
  - "**/*.test.tsx"
  - "**/*.spec.ts"
  - "**/*.spec.tsx"
  - "e2e/**"
  - "playwright.config.ts"
---

# Tests

- Unit test every pure rule: layout/slot math, montage composition, filename, copies.
- Test behavior, not implementation.
- E2E (`e2e/`, Playwright on Electron) starts with `FOTOMAGICA_E2E=1` and `FOTOMAGICA_PRINTER=simulated`. It does not use the webcam or the DS-RX1.
- Mark PRD scenarios whose UI doesn't exist yet with `test.fixme`, and turn them into real tests when the UI lands.
- While iterating, run only the tests or specs you touched, with summarized output (`pnpm vitest run <files> --reporter=dot`; `pnpm playwright test <specs> --reporter=dot`). Do not run the full lint, build, unit or Playwright suite yourself; the Husky `pre-push` hook runs oxlint, typecheck, unit tests and Playwright (setup comes with the first implementation). Tail only failures; never paste long test or build logs.
