import { beforeAll, afterAll } from 'vitest';
import { getConfigManager } from './managers/configManagerSingleton.js';
import { closeSequelize } from './sequelize.js';

// Set up test environment
process.env.DATABASE_PROVIDER = 'sqlite';
process.env.NODE_ENV = 'test';

// Initialize the database once for all tests
export const configManager = getConfigManager();

beforeAll(async () => {
    await configManager.init(true); // Use in-memory SQLite
});

afterAll(async () => {
    await closeSequelize();
});
