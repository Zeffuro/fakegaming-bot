import { describe, it, expect, beforeEach } from 'vitest';
import { getSequelize } from '../sequelize.js';
import { TwitchStreamConfig } from '../models/twitch-stream-config.js';
import { YoutubeVideoConfig } from '../models/youtube-video-config.js';

// These tests rely on migrations having run via vitest.setup.ts

describe('data hygiene constraints', () => {
    beforeEach(async () => {
        // Clean the two tables between tests
        const sequelize = getSequelize(true);
        await sequelize.truncate({ cascade: true, restartIdentity: true });
    });

    it('enforces unique (guildId, twitchUsername) on TwitchStreamConfigs', async () => {
        await TwitchStreamConfig.create({ guildId: 'g1', twitchUsername: 'streamer', discordChannelId: 'chan1' });
        await expect(
            TwitchStreamConfig.create({ guildId: 'g1', twitchUsername: 'streamer', discordChannelId: 'chan2' })
        ).rejects.toThrow();
        // Different guild is allowed
        await expect(
            TwitchStreamConfig.create({ guildId: 'g2', twitchUsername: 'streamer', discordChannelId: 'chan3' })
        ).resolves.toBeTruthy();
    });

    it('enforces unique (guildId, youtubeChannelId) on YoutubeVideoConfigs', async () => {
        await YoutubeVideoConfig.create({ guildId: 'g9', youtubeChannelId: 'yt1', discordChannelId: 'chan9' });
        await expect(
            YoutubeVideoConfig.create({ guildId: 'g9', youtubeChannelId: 'yt1', discordChannelId: 'chanX' })
        ).rejects.toThrow();
        // Different guild is allowed
        await expect(
            YoutubeVideoConfig.create({ guildId: 'g10', youtubeChannelId: 'yt1', discordChannelId: 'chanY' })
        ).resolves.toBeTruthy();
    });
});

