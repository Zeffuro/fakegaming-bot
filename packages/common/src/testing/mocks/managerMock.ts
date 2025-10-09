import { BaseManager } from '../../managers/baseManager.js';
import { ConfigManager } from '../../managers/configManager.js';
import { vi } from 'vitest';

type ManagerMethodMocks = {
    [key: string]: ReturnType<typeof vi.fn>;
};

let activeMockConfigManager: any;

/**
 * Dynamically creates a mock manager by:
 * 1. Auto-mocking all BaseManager methods
 * 2. Auto-detecting and mocking custom methods from the real manager class
 * 3. Applying user overrides
 */
function createDynamicMockManager<T extends BaseManager<any>>(
    ManagerClass: new () => T,
    defaultOverrides: ManagerMethodMocks = {},
    userOverrides: ManagerMethodMocks = {}
): any {
    const mockManager: ManagerMethodMocks = {};

    // 1. Mock all BaseManager methods
    const baseMethodNames = Object.getOwnPropertyNames(BaseManager.prototype)
        .filter(name => name !== 'constructor' && typeof (BaseManager.prototype as any)[name] === 'function');

    for (const name of baseMethodNames) {
        mockManager[name] = vi.fn();
    }

    // 2. Auto-detect custom methods from the specific manager class
    const customMethodNames = Object.getOwnPropertyNames(ManagerClass.prototype)
        .filter(name => {
            if (name === 'constructor') return false;
            const isBaseMethod = baseMethodNames.includes(name);
            return !isBaseMethod && typeof (ManagerClass.prototype as any)[name] === 'function';
        });

    for (const name of customMethodNames) {
        mockManager[name] = vi.fn();
    }

    // 3. Apply default mocks and user overrides
    return {
        ...mockManager,
        ...defaultOverrides,
        ...userOverrides,
    };
}

/**
 * Registry of default mock implementations for specific manager methods
 * This allows consistent defaults while keeping the system dynamic
 */
const DEFAULT_MANAGER_MOCKS: Record<string, ManagerMethodMocks> = {
    birthdayManager: {
        getAllPlain: vi.fn().mockResolvedValue([]),
        isBirthdayToday: vi.fn().mockReturnValue(false),
    },
    reminderManager: {
        getAllPlain: vi.fn().mockResolvedValue([]),
    },
    twitchManager: {
        getAllStreams: vi.fn().mockResolvedValue([]),
    },
    youtubeManager: {
        getAllChannels: vi.fn().mockResolvedValue([]),
    },
    quoteManager: {
        getQuotesByGuild: vi.fn().mockResolvedValue([]),
    },
    patchNotesManager: {
        getAll: vi.fn().mockResolvedValue([]),
    },
    patchSubscriptionManager: {
        getSubscriptionsForGame: vi.fn().mockResolvedValue([]),
    },
};

/**
 * Creates a complete mock ConfigManager by dynamically discovering all managers
 * from the real ConfigManager class and creating mocks for each
 */
export function createMockConfigManager(managerOverrides: Record<string, ManagerMethodMocks> = {}): ConfigManager {
    const realConfigManager = new ConfigManager();
    const mockConfig: any = {};

    // Dynamically discover all manager properties from ConfigManager
    for (const key of Object.keys(realConfigManager)) {
        const manager = (realConfigManager as any)[key];

        // Only process actual manager instances
        if (manager && typeof manager === 'object' && manager.constructor) {
            const ManagerClass = manager.constructor;
            const defaultMocks = DEFAULT_MANAGER_MOCKS[key] || {};
            const userMocks = managerOverrides[key] || {};

            mockConfig[key] = createDynamicMockManager(ManagerClass, defaultMocks, userMocks);
        }
    }

    activeMockConfigManager = mockConfig;
    return mockConfig as ConfigManager;
}

/**
 * Setup mocks for the entire fakegaming-common/managers package
 */
export async function setupManagerMocks(configManagerOverrides: Record<string, ManagerMethodMocks> = {}): Promise<void> {
    const mockConfigManager = createMockConfigManager(configManagerOverrides);

    vi.doMock('@zeffuro/fakegaming-common/managers', () => ({
        configManager: mockConfigManager,
        getConfigManager: vi.fn(() => mockConfigManager),
    }));
}

/**
 * Get the currently active mock config manager
 */
export function getActiveMockConfigManager(): ConfigManager {
    if (!activeMockConfigManager) {
        throw new Error('No active mock config manager. Did you call setupServiceTest or createMockConfigManager?');
    }
    return activeMockConfigManager;
}

/**
 * Helper to create a mock for a specific manager type
 * Useful when you need a standalone manager mock
 */
export function createMockManager<T extends BaseManager<any>>(
    ManagerClass: new () => T,
    overrides: ManagerMethodMocks = {}
): T {
    return createDynamicMockManager(ManagerClass, {}, overrides) as T;
}
