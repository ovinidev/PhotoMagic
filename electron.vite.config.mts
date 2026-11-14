import { resolve } from 'node:path'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'electron-vite'

const alias = {
  '@shared': resolve(import.meta.dirname, 'src/shared'),
  '@brand': resolve(import.meta.dirname, 'assets/brand'),
}

export default defineConfig({
  main: {
    resolve: { alias },
  },
  preload: {
    resolve: { alias },
    // The preload runs sandboxed: it cannot require node_modules, so zod is bundled.
    build: { externalizeDeps: { exclude: ['zod'] } },
  },
  renderer: {
    root: resolve(import.meta.dirname, 'src/renderer'),
    resolve: {
      alias: {
        ...alias,
        '@renderer': resolve(import.meta.dirname, 'src/renderer'),
      },
    },
    plugins: [react(), tailwindcss()],
    build: {
      rollupOptions: {
        input: {
          operator: resolve(import.meta.dirname, 'src/renderer/operator.html'),
          guest: resolve(import.meta.dirname, 'src/renderer/guest.html'),
        },
      },
    },
  },
})
