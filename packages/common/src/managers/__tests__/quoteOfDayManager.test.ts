import { beforeEach, describe, expect, it } from 'vitest';
import { configManager } from '../../vitest.setup.js';

describe('QuoteOfDayManager', () => {
    const manager = configManager.quoteOfDayManager;

    beforeEach(async () => {
        await manager.removeAll();
    });

    it('upserts settings by guild and clamps run hour', async () => {
        const created = await manager.upsertForGuild({
            guildId: 'guild-1',
            channelId: 'channel-1',
            enabled: true,
            runHourUtc: 26,
        });

        expect(created).toMatchObject({
            guildId: 'guild-1',
            channelId: 'channel-1',
            enabled: true,
            runHourUtc: 23,
        });

        const updated = await manager.upsertForGuild({
            guildId: 'guild-1',
            channelId: 'channel-2',
            enabled: false,
            runHourUtc: -2,
        });

        expect(updated).toMatchObject({
            guildId: 'guild-1',
            channelId: 'channel-2',
            enabled: false,
            runHourUtc: 0,
        });
        await expect(manager.getAllPlain()).resolves.toHaveLength(1);
    });

    it('lists enabled settings for a UTC run hour', async () => {
        await manager.upsertForGuild({ guildId: 'guild-1', channelId: 'channel-1', enabled: true, runHourUtc: 9 });
        await manager.upsertForGuild({ guildId: 'guild-2', channelId: 'channel-2', enabled: true, runHourUtc: 10 });
        await manager.upsertForGuild({ guildId: 'guild-3', channelId: 'channel-3', enabled: false, runHourUtc: 9 });

        await expect(manager.listEnabledForHour(9)).resolves.toEqual([
            expect.objectContaining({ guildId: 'guild-1' }),
        ]);
    });
});
