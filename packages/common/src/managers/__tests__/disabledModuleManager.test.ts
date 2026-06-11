import { beforeEach, describe, expect, it } from 'vitest';
import { DisabledModuleConfig } from '../../models/disabled-module-config.js';
import { configManager } from '../../vitest.setup.js';

describe('DisabledModuleManager', () => {
    const disabledModuleManager = configManager.disabledModuleManager;

    beforeEach(async () => {
        await disabledModuleManager.removeAll();
    });

    it('returns true when a module is disabled for a guild', async () => {
        await DisabledModuleConfig.create({
            guildId: 'guild-1',
            moduleName: 'twitch',
        });

        await expect(disabledModuleManager.isModuleDisabled('guild-1', 'twitch')).resolves.toBe(true);
    });

    it('returns false when a module is not disabled for a guild', async () => {
        await DisabledModuleConfig.create({
            guildId: 'guild-1',
            moduleName: 'twitch',
        });

        await expect(disabledModuleManager.isModuleDisabled('guild-2', 'twitch')).resolves.toBe(false);
        await expect(disabledModuleManager.isModuleDisabled('guild-1', 'youtube')).resolves.toBe(false);
    });
});
