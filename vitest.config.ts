import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  resolve: {
    // Example word plugins import { PizxError } from '@topce/pizx' (the same
    // import a user project would use). In-repo tests resolve it to the
    // sources so instanceof checks share one class copy with the core.
    alias: {
      '@topce/pizx': fileURLToPath(new URL('./src/index.ts', import.meta.url)),
    },
  },
  test: {
    include: ['src/**/*.test.ts'],
    environment: 'node',
  },
})
