/// <reference types="vitest" />
import { defineConfig } from 'vitest/config';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
    // Ensure Vite resolves aliases for local modules
    resolve: {
        alias: {
            '@': path.resolve(__dirname),
            '@zeffuro/fakegaming-bot-api': path.resolve(__dirname, 'test-stubs/fakegaming-bot-api.ts'),
            '@zeffuro/fakegaming-bot-api/middleware/auth': path.resolve(__dirname, 'test-stubs/api-middleware-auth.ts'),
            'express': path.resolve(__dirname, 'test-stubs/express.ts'),
        },
    },
    test: {
        globals: true,
        environment: 'jsdom',
        include: ['lib/**/*.{test,spec}.{ts,tsx}'],
        setupFiles: ['lib/test-setup.ts'],
        coverage: {
            provider: 'v8',
            reporter: ['text', 'json', 'html', 'lcov'],
            reportsDirectory: '../../coverage/dashboard',
            include: ['lib/**/*.ts', 'lib/**/*.tsx'],
            exclude: [
                '**/*.{test,spec}.ts',
                '**/*.{test,spec}.tsx',
                'types/**/*',
                '.next/**/*',
                'next-env.d.ts',
                'next.config.js',
                'app/**',
                'public/**',
                'scripts/**',
                'lib/common/**',
                // Exclude non-unit registries/helpers and thin API wrapper (integration-tested via API stubs)
                'lib/commands.ts',
                'lib/modules.ts',
                'lib/api-client.ts',
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
            '@': path.resolve(__dirname),
            '@zeffuro/fakegaming-bot-api': path.resolve(__dirname, 'test-stubs/fakegaming-bot-api.ts'),
            '@zeffuro/fakegaming-bot-api/middleware/auth': path.resolve(__dirname, 'test-stubs/api-middleware-auth.ts'),
            'express': path.resolve(__dirname, 'test-stubs/express.ts'),
        },
    },
});
