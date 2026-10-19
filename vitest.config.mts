import path from 'node:path'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    include: ['lib/__tests__/**/*.test.ts'],
    environment: 'node',
    setupFiles: ['test/setup.ts'],
  },
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname),
      'react-native': path.resolve(import.meta.dirname, 'test/react-native-stub.ts'),
    },
  },
})
