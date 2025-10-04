// filepath: F:\Coding\discord-bot\packages\common\src\testing\utils\testUtils.ts
import { vi, beforeEach, afterEach } from 'vitest';
import path from 'path';

// Import all mock utilities
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

    // Set up all the mock systems as requested
    if (setupCache) {
        setupCacheMocks();
    }

    if (setupDiscord) {
        setupDiscordMocks();
    }

    if (setupManagers) {
        setupManagerMocks(managerOverrides);
    }

    if (setupModels) {
        setupModelMocks();
    }

    // Allow imports to be processed
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
    // IMPORTANT: Setup test BEFORE importing the command
    // This ensures mocks are in place when the command imports dependencies
    await setupTest(options);

    // Create default interaction and client
    const interaction = createMockCommandInteraction(options.interaction || {});
    const client = createMockClient(options.client || {});

    // Get the active mock config manager that was set up
    const configManager = getActiveMockConfigManager();

    // Make sure the mocks are properly initialized for imports
    vi.doMock('@zeffuro/fakegaming-common/managers', () => {
        return {
            configManager,
            getConfigManager: vi.fn(() => configManager),
        };
    });

    // Import the command module AFTER mocks are set up
    let commandModule;
    try {
        // Make sure we're working with a JavaScript file, not TypeScript
        const jsPath = commandPath.replace(/\.ts$/, '.js');

        // If the path is absolute, use it directly
        // Otherwise, resolve it against the project root
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

// Re-export all mock utilities for convenience
export * from '../mocks/cacheMock.js';
export * from '../mocks/discordMock.js';
export * from '../mocks/managerMock.js';
export * from '../mocks/modelMock.js';

// Re-export createMockConfigManager for external use
export { createMockConfigManager };
