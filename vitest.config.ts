// ============================================================
// Vitest Configuration — Unit tests
// Environment: happy-dom (browser-like DOM simulation)
// ============================================================

import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    environment: 'happy-dom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/lib/__tests__/**/*.test.ts', 'src/test/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      include: [
        'src/lib/validators/index.ts',
        'src/lib/retry.ts',
        'src/lib/logger.ts',
        'src/lib/password.ts',
        'src/lib/quota.ts',
        'src/lib/bigint.ts',
        'src/lib/activity-logger.ts',
      ],
      exclude: ['src/lib/__tests__/**'],
      thresholds: {
        lines: 80,
        functions: 80,
        branches: 70,
        statements: 80,
      },
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});
