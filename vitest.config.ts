import path from 'node:path'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    include: ['lib/__tests__/**/*.test.ts'],
    environment: 'node',
  },
  resolve: {
    alias: {
      'react-native': path.resolve(__dirname, 'test/react-native-stub.ts'),
    },
  },
})
