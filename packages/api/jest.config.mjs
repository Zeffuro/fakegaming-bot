export default {
    preset: 'ts-jest/presets/default-esm',
    testEnvironment: 'node',
    setupFilesAfterEnv: ['./src/jest.setup.ts'],
    extensionsToTreatAsEsm: ['.ts'],
    moduleFileExtensions: ['ts', 'js', 'json'],
    roots: ['<rootDir>/src'],
    moduleNameMapper: {
        '^(\\.{1,2}/.*)\\.js$': '$1',
    },
    testPathIgnorePatterns: ["/node_modules/"],
    transform: {
        '^.+\\.m?[tj]sx?$': [
            'ts-jest',
            {
                useESM: true,
            },
        ],
    },
    testMatch: ["**/__tests__/**/*.test.ts"],
};