import { vi, beforeEach, afterEach } from 'vitest';
import type { Express } from 'express';
import type { ConfigManager } from '../../managers/index.js';
import { setupTest, type TestSetupOptions } from './testUtils.js';
import { getActiveMockConfigManager } from '../mocks/managerMock.js';

/**
 * Options for API test setup
 */
export interface ApiTestSetupOptions extends TestSetupOptions {
    /**
     * Custom ConfigManager instance to use (defaults to mock)
     */
    configManager?: ConfigManager;
    /**
     * Mock environment variables
     */
    env?: Record<string, string>;
}

/**
 * Sets up all necessary mocks and configuration for API testing
 *
 * @param options Configuration options for API test setup
 * @returns ConfigManager instance to use in tests
 */
export async function setupApiTest(options: ApiTestSetupOptions = {}): Promise<ConfigManager> {
    const {
        env = {},
        configManager,
        ...testOptions
    } = options;

    // Set default test environment variables
    process.env.DATABASE_PROVIDER = 'sqlite';
    process.env.NODE_ENV = 'test';
    process.env.JWT_SECRET = process.env.JWT_SECRET || 'testsecret';
    process.env.JWT_AUDIENCE = process.env.JWT_AUDIENCE || 'fakegaming-dashboard';

    // Apply custom env vars
    Object.assign(process.env, env);

    // Setup base test infrastructure
    await setupTest(testOptions);

    // Return either provided or mocked ConfigManager
    return configManager || getActiveMockConfigManager();
}

/**
 * Create a test context for API route testing with supertest
 *
 * @param options Configuration options
 * @returns Test context with app factory and config manager
 */
export async function setupApiRouteTest(options: ApiTestSetupOptions & {
    /**
     * Optional app factory function
     */
    appFactory?: (configManager: ConfigManager) => Express | Promise<Express>;
} = {}) {
    const { appFactory, ...setupOptions } = options;

    const configManager = await setupApiTest(setupOptions);

    return {
        configManager,
        /**
         * Creates an Express app instance for testing
         * Uses provided factory or imports from API package
         */
        createApp: async (): Promise<Express> => {
            if (appFactory) {
                return await appFactory(configManager);
            }
            // Import from API package - this will be available when testing API routes
            // For unit tests in common package, provide a custom appFactory
            // @ts-expect-error - API package import will be available at runtime in API tests
            const { default: app } = await import('@zeffuro/fakegaming-bot-api');
            return app;
        },
    };
}

/**
 * Helper to setup and teardown API tests for a test suite
 */
export function withApiTest(options: ApiTestSetupOptions = {}) {
    let configManager: ConfigManager;

    beforeEach(async () => {
        configManager = await setupApiTest(options);
    });

    afterEach(() => {
        vi.resetAllMocks();
    });

    return {
        getConfigManager: () => configManager,
    };
}
