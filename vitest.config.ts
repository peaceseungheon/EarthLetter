import { defineConfig } from 'vitest/config'
import { fileURLToPath } from 'node:url'

export default defineConfig({
  test: {
    include: ['tests/unit/**/*.spec.ts', 'tests/api/**/*.spec.ts'],
    environment: 'node',
    globals: false
  },
  resolve: {
    alias: {
      '~': fileURLToPath(new URL('.', import.meta.url)),
      '@': fileURLToPath(new URL('.', import.meta.url))
    }
  }
})
