import { defineConfig } from '@playwright/test'

/**
 * Playwright against the built Electron app (`_electron.launch`), not a browser.
 * `e2e/global-setup.ts` builds `out/` once per run, so `pnpm exec playwright test <spec>` works alone.
 */
export default defineConfig({
  testDir: './e2e',
  globalSetup: './e2e/global-setup.ts',
  fullyParallel: false,
  workers: 1,
  forbidOnly: !!process.env['CI'],
  retries: process.env['CI'] ? 1 : 0,
  timeout: 30_000,
  reporter: process.env['CI'] ? [['list'], ['html', { open: 'never' }]] : 'list',
  use: {
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
})
