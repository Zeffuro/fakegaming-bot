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
      reportsDirectory: '../../coverage/common',
      include: ['src/**/*.ts'],
      exclude: [
        'src/**/*.{test,spec}.ts',
        'src/test/**/*',
        'src/types/**/*',
        'src/**/*.d.ts',
        'src/**/types.ts', // Exclude all types.ts files
        'src/index.ts',
        'src/**/index.ts', // Exclude all index.ts files in subdirectories
        'src/**/*.js',
        'src/migrate.ts', // Migration runner itself
        'src/vitest.setup.ts',
        'src/testing/**/*', // Exclude all test utilities and mocks
        // Exclude non-critical codegen/infra utilities that are validated indirectly
        'src/utils/modelToZod.ts',
        'src/utils/openapi.ts',
        'src/utils/schemaRegistry.ts',
        'src/utils/validation.ts',
        'src/core/dataRoot.ts',
        // Newly excluded generated/config files
        'src/manifest/**/*', // Auto-generated manifest validated by scripts
        'src/validation/schemaOverrides.ts', // Declarative schema wiring validated via integration
        // DB-backed rate limiter logic is primarily exercised via integration in API; exclude from unit coverage
        'src/rate-limiter.ts',
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
    },
  },
});
