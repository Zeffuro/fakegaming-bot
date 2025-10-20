/// <reference types="vitest" />
import { defineConfig } from 'vitest/config';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    setupFiles: ['./src/vitest.setup.ts'],
    include: ['src/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html', 'lcov'],
      reportsDirectory: '../../coverage/api',
      include: ['src/**/*.ts'],
      exclude: [
        'src/**/*.{test,spec}.ts',
        'src/test/**/*',
        'src/types/**/*',
        'src/**/*.d.ts',
        'src/**/types.ts',
        'src/index.ts', // Entry point
        'src/**/index.ts',
        'src/**/*.js',
        'src/vitest.setup.ts',
        'src/__tests__/**/*', // Test helpers
        'src/utils/openapi-inject-schemas.ts', // Build-time utility
        'src/utils/sequelize-to-openapi.ts', // Build-time utility
        // Exclude deprecated validation overrides placeholder
        'src/validation/**/*.ts',
      ],
      thresholds: {
        lines: 80,
        functions: 80,
        branches: 75,
        statements: 80,
      },
    },
    alias: {
      '@': path.resolve(__dirname, 'src'),
      '@zeffuro/fakegaming-bot-api': path.resolve(__dirname, 'src/index.ts'),
    },
  },
});
