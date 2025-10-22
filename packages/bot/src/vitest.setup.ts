import { vi, beforeEach } from 'vitest';
import type { ConfigManager } from '@zeffuro/fakegaming-common/managers';

/**
 * CRITICAL: This must be at top-level, before any test imports the SUT.
 */
vi.mock('@zeffuro/fakegaming-common/managers', async () => {
    // Lazily import testing helpers to create a mock config manager on-demand
    const testing = await vi.importActual<typeof import('@zeffuro/fakegaming-common/testing')>('@zeffuro/fakegaming-common/testing');
    function getActive(): ConfigManager {
        const g = globalThis as any;
        if (!g.__FG_ACTIVE_CONFIG_MANAGER__) {
            testing.createMockConfigManager({});
        }
        return g.__FG_ACTIVE_CONFIG_MANAGER__ as ConfigManager;
    }
    return { getConfigManager: () => getActive() } as unknown as { getConfigManager: () => ConfigManager };
});

// Provide a shared mock logger across all tests in this package.
// We partially mock @zeffuro/fakegaming-common to override getLogger while keeping other exports intact.
vi.mock('@zeffuro/fakegaming-common', async () => {
    const actual = await vi.importActual<any>('@zeffuro/fakegaming-common');
    const testLogger = {
        error: vi.fn(),
        warn: vi.fn(),
        info: vi.fn(),
        debug: vi.fn(),
        child: vi.fn(function (this: unknown) { return this; })
    } as unknown as { error: (..._args: unknown[]) => void; warn: (..._args: unknown[]) => void; info: (..._args: unknown[]) => void; debug: (..._args: unknown[]) => void; child: (..._args: unknown[]) => unknown };

    (globalThis as Record<string, unknown>).__TEST_LOGGER__ = testLogger;

    return {
        ...actual,
        getLogger: vi.fn(() => testLogger)
    };
});

beforeEach(() => {
    vi.clearAllMocks();
});