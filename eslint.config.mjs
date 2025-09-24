import eslintJs from '@eslint/js';
import tseslint from '@typescript-eslint/eslint-plugin';
import tsParser from '@typescript-eslint/parser';

const {configs} = eslintJs;

const nodeGlobals = {
    process: true,
    console: true,
    Buffer: true,
    setTimeout: true,
    setInterval: true,
    clearTimeout: true,
    clearInterval: true,
    __dirname: true,
    __filename: true,
    global: true,
    require: true,
    exports: true,
    module: true,
};

export default [
    configs.recommended,
    {
        files: [
            'packages/bot/src/**/*.ts',
            'packages/bot/src/**/*.js',
            'packages/common/src/**/*.ts',
            'packages/common/src/**/*.js',
            'packages/dashboard/src/**/*.ts',
            'packages/dashboard/src/**/*.js',
        ],
        ignores: ['dist/**', 'node_modules/**'],
        languageOptions: {
            parser: tsParser,
            parserOptions: {
                project: '../../tsconfig.json',
                sourceType: 'module',
            },
            globals: nodeGlobals,
        },
        plugins: {
            '@typescript-eslint': tseslint,
        },
        rules: {
            'no-unused-vars': ['error', {'argsIgnorePattern': '^_'}],
        },
    },
    {
        files: [
            'packages/bot/src/**/*.test.ts',
            'packages/bot/src/**/*.test.js',
            'packages/common/src/**/*.test.ts',
            'packages/common/src/**/*.test.js',
            'packages/dashboard/src/**/*.test.ts',
            'packages/dashboard/src/**/*.test.js',
        ],
        ignores: ['dist/**', 'node_modules/**'],
        languageOptions: {
            globals: {
                ...nodeGlobals,
                describe: true,
                it: true,
                beforeEach: true,
                expect: true,
                jest: true,
            },
        },
    },
];