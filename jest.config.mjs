export default {
    testEnvironment: 'node',
    extensionsToTreatAsEsm: ['.ts'],
    moduleFileExtensions: ['ts', 'js', 'json'],
    roots: [
        '<rootDir>/packages/bot/src',
        '<rootDir>/packages/common/src',
        '<rootDir>/packages/dashboard/src'
    ],
    transform: {
        "^.+\\.(t|j)sx?$": ["@swc/jest"],
    },
    transformIgnorePatterns: [
        "/node_modules/(?!@zeffuro/fakegaming-common/)"
    ],
    moduleNameMapper: {
        '^(\\.{1,2}/.*)\\.js$': '$1',
    },
};