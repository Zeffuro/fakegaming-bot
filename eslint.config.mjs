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
        files: ['src/**/*.ts', 'src/**/*.js'],
        ignores: ['dist/**', 'node_modules/**'],
        languageOptions: {
            parser: tsParser,
            parserOptions: {
                project: './tsconfig.json',
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
        files: ['src/**/*.test.ts', 'src/**/*.test.js'],
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