import { execFileSync } from 'node:child_process'

/** Builds main, preload and renderer into `out/`. Output is shown only if the build fails. */
export default function globalSetup(): void {
  if (process.env['FOTOMAGICA_E2E_SKIP_BUILD'] === '1') return
  try {
    execFileSync('pnpm', ['exec', 'electron-vite', 'build'], {
      stdio: 'pipe',
      shell: process.platform === 'win32',
    })
  } catch (error) {
    const { stdout, stderr } = error as { stdout?: Buffer; stderr?: Buffer }
    process.stderr.write(stdout?.toString() ?? '')
    process.stderr.write(stderr?.toString() ?? '')
    throw new Error('electron-vite build failed before E2E')
  }
}
