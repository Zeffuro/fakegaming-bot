import { beforeEach, describe, expect, it } from 'vitest';
import { BlueskyPostConfig } from '../../models/bluesky-post-config.js';
import { configManager } from '../../vitest.setup.js';

describe('BlueskyManager', () => {
    const blueskyManager = configManager.blueskyManager;

    beforeEach(async () => {
        await blueskyManager.removeAll();
    });

    it('returns all configured accounts', async () => {
        await BlueskyPostConfig.create({
            blueskyHandle: 'creator.bsky.social',
            discordChannelId: 'channel-1',
            guildId: 'guild-1',
        });

        const accounts = await blueskyManager.getAllAccounts();

        expect(accounts).toHaveLength(1);
        expect(accounts[0]?.blueskyHandle).toBe('creator.bsky.social');
    });

    it('checks account existence by handle, channel, and guild', async () => {
        await BlueskyPostConfig.create({
            blueskyHandle: 'creator.bsky.social',
            discordChannelId: 'channel-1',
            guildId: 'guild-1',
        });

        await expect(blueskyManager.accountExists('creator.bsky.social', 'channel-1', 'guild-1')).resolves.toBe(true);
        await expect(blueskyManager.accountExists('creator.bsky.social', 'channel-2', 'guild-1')).resolves.toBe(false);
    });

    it('creates and updates accounts by guild and handle', async () => {
        const created = await blueskyManager.upsertAccount({
            blueskyHandle: 'creator.bsky.social',
            discordChannelId: 'channel-1',
            guildId: 'guild-1',
        });
        expect(created.created).toBe(true);
        expect(created.record?.discordChannelId).toBe('channel-1');

        const updated = await blueskyManager.upsertAccount({
            blueskyHandle: 'creator.bsky.social',
            discordChannelId: 'channel-2',
            guildId: 'guild-1',
        });
        expect(updated.created).toBe(false);
        expect(updated.record?.discordChannelId).toBe('channel-2');
    });

    it('removes an account by composite identity', async () => {
        await BlueskyPostConfig.create({
            blueskyHandle: 'creator.bsky.social',
            discordChannelId: 'channel-1',
            guildId: 'guild-1',
        });

        await blueskyManager.removeAccount('creator.bsky.social', 'channel-1', 'guild-1');

        await expect(blueskyManager.accountExists('creator.bsky.social', 'channel-1', 'guild-1')).resolves.toBe(false);
    });
});
