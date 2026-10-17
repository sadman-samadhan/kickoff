import { defineConfig } from 'vitest/config'
import path from 'path'

export default defineConfig({
  esbuild: { jsx: 'automatic' },
  resolve: {
    alias: {
      '@': path.resolve(__dirname),
      'server-only': path.resolve(__dirname, 'tests/stubs/empty.ts'),
    },
  },
  test: {
    include: ['tests/**/*.test.{ts,tsx}'],
    testTimeout: 60_000,
    // Each DB test file loads the full schema into an in-memory Postgres; slow under parallel load.
    hookTimeout: 60_000,
  },
})
