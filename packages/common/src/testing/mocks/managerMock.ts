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
 * Applies manager method overrides to the target config object
 */
function applyManagerOverrides(targetConfig: any, managerOverrides: Record<string, ManagerMethodMocks>) {
    for (const [key, overrides] of Object.entries(managerOverrides)) {
        if (!targetConfig[key]) continue;
        const manager = targetConfig[key] as Record<string, ReturnType<typeof vi.fn>>;
        for (const [method, fn] of Object.entries(overrides)) {
            // Replace or assign the method to the provided spy
            (manager as any)[method] = fn as any;
        }
    }
}

/**
 * Ensures there is an active mock ConfigManager, creating one if necessary,
 * and applies any provided manager overrides
 */
function ensureActiveMock(managerOverrides: Record<string, ManagerMethodMocks> = {}): ConfigManager {
    const g = globalThis as any;
    if (!g.__FG_ACTIVE_CONFIG_MANAGER__ || !activeMockConfigManager) {
        // Create a brand new mock config manager
        const real = new ConfigManager();
        const mockConfig: any = {};
        for (const key of Object.keys(real)) {
            const manager = (real as any)[key];
            if (manager && typeof manager === 'object' && manager.constructor) {
                const ManagerClass = manager.constructor;
                const defaultMocks = DEFAULT_MANAGER_MOCKS[key] || {};
                mockConfig[key] = createDynamicMockManager(ManagerClass, defaultMocks, {});
            }
        }
        activeMockConfigManager = mockConfig;
        g.__FG_ACTIVE_CONFIG_MANAGER__ = activeMockConfigManager;
    }
    // Apply overrides onto existing instance to preserve object identity and any spies
    applyManagerOverrides(activeMockConfigManager, managerOverrides);
    return activeMockConfigManager as ConfigManager;
}

/**
 * Creates a complete mock ConfigManager by dynamically discovering all managers
 * from the real ConfigManager class and creating mocks for each
 */
export function createMockConfigManager(managerOverrides: Record<string, ManagerMethodMocks> = {}): ConfigManager {
    // Backwards-compatible API: ensure there is an active mock and then apply overrides
    return ensureActiveMock(managerOverrides);
}

/**
 * Setup mocks for the entire fakegaming-common/managers package
 */
export async function setupManagerMocks(configManagerOverrides: Record<string, ManagerMethodMocks> = {}): Promise<void> {
    // Ensure or update the active mock
    ensureActiveMock(configManagerOverrides);

    // Ensure any subsequent imports of the managers module return the current active mock
    vi.doMock('@zeffuro/fakegaming-common/managers', async () => {
        return {
            // Read from global to avoid depending on a specific module instance
            getConfigManager: () => (globalThis as any).__FG_ACTIVE_CONFIG_MANAGER__ as ConfigManager,
        } as unknown as { getConfigManager: () => ConfigManager };
    });
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
