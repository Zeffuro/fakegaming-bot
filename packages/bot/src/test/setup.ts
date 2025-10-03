// This file runs before all tests to set up the test environment
import { jest } from '@jest/globals';

// Mock the core modules once and let individual tests customize as needed
jest.mock('@zeffuro/fakegaming-common/dist/managers/configManagerSingleton.js', () => {
  // Import the actual mock implementation
  return require('./mocks/configManagerSingleton.ts');
}, { virtual: true });

// Also mock the new import path if being used by newer code
jest.mock('@zeffuro/fakegaming-common/managers', () => {
  // Import the actual mock implementation
  return require('./mocks/configManagerSingleton.ts');
}, { virtual: true });

// Mock the models path that some tests are trying to use
jest.mock('@zeffuro/fakegaming-common/dist/models/league-config.js', () => {
  return {
    LeagueConfig: {
      create: jest.fn().mockResolvedValue({}),
      update: jest.fn().mockResolvedValue({})
    }
  };
}, { virtual: true });

// Set up any global test configuration here
beforeAll(() => {
  // Global setup before running tests
});

afterAll(() => {
  // Global cleanup after all tests
});

// Reset mocks between tests to ensure test isolation
beforeEach(() => {
  jest.resetAllMocks();
});
