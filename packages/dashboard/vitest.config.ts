/// <reference types="vitest" />
import { defineConfig } from 'vitest/config';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
    // Ensure Vite resolves aliases for all modules (including node_modules)
    resolve: {
        alias: {
            '@': path.resolve(__dirname),
            '@/lib/common/testing.js': path.resolve(__dirname, 'lib/common/testing.ts'),
            '@zeffuro/fakegaming-common/testing/mocks/cache': path.resolve(__dirname, '../common/dist/testing/mocks/cacheMock.js'),
            '@zeffuro/fakegaming-common/testing/utils/jwt': path.resolve(__dirname, '../common/dist/testing/utils/jwtTestUtils.js'),
            '@zeffuro/fakegaming-common/utils': path.resolve(__dirname, '../common/dist/utils/index.js'),
            '@zeffuro/fakegaming-bot-api': path.resolve(__dirname, 'test-stubs/fakegaming-bot-api.ts'),
            '@zeffuro/fakegaming-bot-api/middleware/auth': path.resolve(__dirname, 'test-stubs/api-middleware-auth.ts'),
            'express': path.resolve(__dirname, 'test-stubs/express.ts'),
        },
    },
    test: {
        globals: true,
        environment: 'jsdom',
        include: ['lib/**/*.{test,spec}.{ts,tsx}'],
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
            '@/lib/common/testing.js': path.resolve(__dirname, 'lib/common/testing.ts'),
            '@zeffuro/fakegaming-common/testing/mocks/cache': path.resolve(__dirname, '../common/dist/testing/mocks/cacheMock.js'),
            '@zeffuro/fakegaming-common/testing/utils/jwt': path.resolve(__dirname, '../common/dist/testing/utils/jwtTestUtils.js'),
            '@zeffuro/fakegaming-common/utils': path.resolve(__dirname, '../common/dist/utils/index.js'),
            '@zeffuro/fakegaming-bot-api': path.resolve(__dirname, 'test-stubs/fakegaming-bot-api.ts'),
            '@zeffuro/fakegaming-bot-api/middleware/auth': path.resolve(__dirname, 'test-stubs/api-middleware-auth.ts'),
            'express': path.resolve(__dirname, 'test-stubs/express.ts'),
        },
    },
});
