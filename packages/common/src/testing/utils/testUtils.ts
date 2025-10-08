import { vi, beforeEach, afterEach } from 'vitest';
import path from 'path';

import { setupCacheMocks, resetCacheMocks } from '../mocks/cacheMock.js';
import { setupDiscordMocks, createMockCommandInteraction, createMockClient } from '../mocks/discordMock.js';
import { setupManagerMocks, createMockConfigManager, getActiveMockConfigManager } from '../mocks/managerMock.js';
import { setupModelMocks } from '../mocks/modelMock.js';
import { PROJECT_ROOT } from '../../core/projectRoot.js';

/**
 * Options for test setup
 */
export interface TestSetupOptions {
    setupCache?: boolean;
    setupDiscord?: boolean;
    setupManagers?: boolean;
    setupModels?: boolean;
    managerOverrides?: Record<string, any>;
}

/**
 * Sets up all necessary mocks for a test
 *
 * @param options Configuration options for test setup
 */
export async function setupTest(options: TestSetupOptions = {}): Promise<void> {
    const {
        setupCache = true,
        setupDiscord = true,
        setupManagers = true,
        setupModels = true,
        managerOverrides = {}
    } = options;

    if (setupCache) {
        setupCacheMocks();
    }

    if (setupDiscord) {
        setupDiscordMocks();
    }

    if (setupModels) {
        setupModelMocks();
    }

    if (setupManagers) {
        setupManagerMocks(managerOverrides);
    }

    await new Promise(resolve => setTimeout(resolve, 0));
}

/**
 * Reset all mocks between tests
 */
export function resetMocks(): void {
    resetCacheMocks();
    vi.resetAllMocks();
}

/**
 * Create a test context with all necessary mocks for command testing
 *
 * @param commandPath Path to the command module to test
 * @param options Additional configuration options
 * @returns Test context with command and mocks
 */
export async function setupCommandTest(commandPath: string, options: TestSetupOptions & {
    interaction?: Record<string, any>;
    client?: Record<string, any>;
} = {}) {
    await setupTest(options);

    const interaction = createMockCommandInteraction(options.interaction || {});
    const client = createMockClient(options.client || {});

    const configManager = getActiveMockConfigManager();

    let commandModule;
    try {
        const jsPath = commandPath.replace(/\.ts$/, '.js');

        const resolvedPath = path.isAbsolute(jsPath)
            ? jsPath
            : path.join(PROJECT_ROOT, 'packages', 'bot', 'src', jsPath);

        commandModule = await import(resolvedPath);
    } catch (err) {
        console.error(`Error importing command from path: ${commandPath}`, err);
        throw err;
    }
    const command = commandModule.default;

    return {
        command,
        interaction,
        client,
        configManager
    };
}

/**
 * Create a test context for service testing (e.g., birthdayService)
 *
 * @param options Configuration options for test setup
 * @returns Test context with mocked client and config manager
 */
export async function setupServiceTest(options: TestSetupOptions & {
    client?: Record<string, any>;
} = {}) {
    await setupTest(options);

    const client = createMockClient(options.client || {});
    const configManager = getActiveMockConfigManager();

    return {
        client,
        configManager
    };
}

/**
 * Helper to setup and teardown all mocks for a test suite
 */
export function withAllMocks() {
    beforeEach(async () => {
        await setupTest();
    });

    afterEach(() => {
        resetMocks();
    });
}

export * from '../mocks/cacheMock.js';
export * from '../mocks/discordMock.js';
export * from '../mocks/managerMock.js';
export * from '../mocks/modelMock.js';

export { createMockConfigManager };
