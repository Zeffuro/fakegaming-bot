export default {
    testEnvironment: 'node',
    extensionsToTreatAsEsm: ['.ts'],
    moduleFileExtensions: ['ts', 'js', 'json'],
    roots: ['<rootDir>/src'],
    moduleNameMapper: {
        '^(\\.{1,2}/.*)\\.js$': '$1',
        '^@zeffuro/fakegaming-common/dist/managers/configManagerSingleton\\.js$': '<rootDir>/src/test/mocks/configManagerSingleton.ts',
        '^@zeffuro/fakegaming-common/managers$': '<rootDir>/src/test/mocks/configManagerSingleton.ts',
        '^@zeffuro/fakegaming-common/dist/models/league-config\\.js$': '<rootDir>/src/test/mocks/leagueConfig.ts'
    },
    transform: {
        "^.+\\.(t|j)sx?$": ["@swc/jest"],
    },
    setupFilesAfterEnv: ['<rootDir>/src/test/setup.ts'],
};