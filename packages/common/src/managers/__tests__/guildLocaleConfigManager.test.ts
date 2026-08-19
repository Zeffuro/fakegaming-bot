import { beforeEach, describe, expect, it } from 'vitest';
import { configManager } from '../../vitest.setup.js';
import { GuildLocaleConfig } from '../../models/guild-locale-config.js';

describe('GuildLocaleConfigManager', () => {
    const manager = configManager.guildLocaleConfigManager;

    beforeEach(async () => {
        await manager.removeAll();
    });

    it('uses English for a missing config without creating a row', async () => {
        await expect(manager.getOutputLocale('guild-missing')).resolves.toBe('en');
        await expect(GuildLocaleConfig.count()).resolves.toBe(0);
    });

    it('creates and updates a single validated output locale per guild', async () => {
        await expect(manager.setOutputLocale('guild-1', 'nl')).resolves.toEqual({ guildId: 'guild-1', outputLocale: 'nl' });
        await expect(manager.getOutputLocale('guild-1')).resolves.toBe('nl');
        await expect(manager.setOutputLocale('guild-1', 'en')).resolves.toEqual({ guildId: 'guild-1', outputLocale: 'en' });
        await expect(GuildLocaleConfig.count()).resolves.toBe(1);
    });

    it('rejects unsupported locales before writing', async () => {
        await expect(manager.setOutputLocale('guild-1', 'fr' as never)).rejects.toThrow('not supported');
        await expect(GuildLocaleConfig.create({ guildId: 'guild-2', outputLocale: 'fr' as never })).rejects.toThrow();
        await expect(GuildLocaleConfig.count()).resolves.toBe(0);
    });
});
