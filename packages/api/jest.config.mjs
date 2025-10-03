export default {
    testEnvironment: 'node',
    extensionsToTreatAsEsm: ['.ts'],
    moduleFileExtensions: ['ts', 'js', 'json'],
    roots: ['<rootDir>/src'],
    moduleNameMapper: {
        '^(\\.{1,2}/.*)\\.js$': '$1',
    },
    transform: {
        "^.+\\.(t|j)sx?$": ["@swc/jest"],
    },
    setupFilesAfterEnv: ['./src/jest.setup.ts'],
    testMatch: ["**/__tests__/**/*.test.ts"],
    testPathIgnorePatterns: ["/node_modules/"],
};