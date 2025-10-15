import { vi, beforeEach } from 'vitest';
import type { ConfigManager } from '@zeffuro/fakegaming-common/managers';

/**
 * CRITICAL: This must be at top-level, before any test imports the SUT.
 * ESM imports are evaluated once and cached. If we mock after the SUT is imported,
 * the SUT's binding to getConfigManager() will already point to the real one.
 */
vi.mock('@zeffuro/fakegaming-common/managers', async () => {
    const testing: { getActiveMockConfigManager: () => ConfigManager } =
        await vi.importActual('@zeffuro/fakegaming-common/testing');

    return {
        getConfigManager: vi.fn(() => testing.getActiveMockConfigManager()),
    };
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