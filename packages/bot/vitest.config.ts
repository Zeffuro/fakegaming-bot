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
      reportsDirectory: '../../coverage/bot',
      include: ['src/**/*.ts'],
      exclude: [
        'src/**/*.{test,spec}.ts',
        'src/test/**/*',
        'src/types/**/*',
        // Infrastructure/entry points - better tested through integration
        'src/index.ts',
        'src/deploy-commands.ts',
        'src/config/db.ts',
        'src/core/FakegamingBot.ts',
        'src/core/preloadModules.ts',
        // Complex canvas rendering - better validated through visual QA
        'src/modules/league/image/**/*Image.ts',
        // Type definition files
        '**/*.d.ts',
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
