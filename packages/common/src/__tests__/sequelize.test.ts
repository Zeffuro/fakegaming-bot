import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

describe('sequelize additional branches', () => {
    const originalEnv = { ...process.env };

    beforeEach(() => {
        vi.resetModules();
        process.env = { ...originalEnv };
    });

    afterEach(() => {
        process.env = { ...originalEnv };
    });

    it('should throw error when DATABASE_URL is missing for non-sqlite provider', async () => {
        process.env.DATABASE_PROVIDER = 'postgres';
        delete process.env.DATABASE_URL;

        const { getSequelize } = await import('../sequelize.js');

        expect(() => getSequelize()).toThrow('DATABASE_URL is required for provider "postgres"');
    });

    it('should use DATABASE_URL for postgres provider', async () => {
        process.env.DATABASE_PROVIDER = 'postgres';
        process.env.DATABASE_URL = 'postgres://localhost:5432/test';

        // This will fail to connect but tests the branch
        const { getSequelize } = await import('../sequelize.js');

        // The function should not throw during initialization
        const sequelize = getSequelize();
        expect(sequelize).toBeDefined();
        expect(sequelize.getDialect()).toBe('postgres');
    });

    it('should use TEST_SQLITE_FILE when provided in test mode', async () => {
        process.env.DATABASE_PROVIDER = 'sqlite';
        process.env.TEST_SQLITE_FILE = '/tmp/test.sqlite';

        const { getSequelize } = await import('../sequelize.js');
        const sequelize = getSequelize(true);

        expect(sequelize).toBeDefined();
    });

    it('should use in-memory sqlite when TEST_SQLITE_FILE is empty in test mode', async () => {
        process.env.DATABASE_PROVIDER = 'sqlite';
        process.env.TEST_SQLITE_FILE = '';

        const { getSequelize } = await import('../sequelize.js');
        const sequelize = getSequelize(true);

        expect(sequelize).toBeDefined();
    });
});