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

beforeEach(() => {
    vi.clearAllMocks();
});