import { describe, it, expect, beforeEach } from 'vitest';
import { configManager } from '../../vitest.setup.js';
import { YoutubeVideoConfig } from '../../models/youtube-video-config.js';

describe('YoutubeManager', () => {
    const youtubeManager = configManager.youtubeManager;

    beforeEach(async () => {
        await youtubeManager.remove({});
    });

    describe('getVideoChannel', () => {
        it('should return video channel config', async () => {
            await YoutubeVideoConfig.create({
                youtubeChannelId: 'yt-channel-1',
                discordChannelId: 'discord-channel-1',
                guildId: 'guild-1',
            });

            const result = await youtubeManager.getVideoChannel({
                youtubeChannelId: 'yt-channel-1',
                discordChannelId: 'discord-channel-1',
                guildId: 'guild-1',
            });

            expect(result).not.toBeNull();
            expect(result?.youtubeChannelId).toBe('yt-channel-1');
            expect(result?.discordChannelId).toBe('discord-channel-1');
        });

        it('should return null if config not found', async () => {
            const result = await youtubeManager.getVideoChannel({
                youtubeChannelId: 'nonexistent',
                discordChannelId: 'discord-channel-1',
                guildId: 'guild-1',
            });

            expect(result).toBeNull();
        });
    });

    describe('setVideoChannel', () => {
        it('should create a new video channel config', async () => {
            await youtubeManager.setVideoChannel({
                youtubeChannelId: 'yt-channel-1',
                discordChannelId: 'discord-channel-1',
                guildId: 'guild-1',
            });

            const result = await youtubeManager.getVideoChannel({
                youtubeChannelId: 'yt-channel-1',
                discordChannelId: 'discord-channel-1',
                guildId: 'guild-1',
            });

            expect(result).not.toBeNull();
        });

        it('should update existing video channel config', async () => {
            await YoutubeVideoConfig.create({
                youtubeChannelId: 'yt-channel-1',
                discordChannelId: 'discord-channel-1',
                guildId: 'guild-1',
            });

            await youtubeManager.setVideoChannel({
                youtubeChannelId: 'yt-channel-1',
                discordChannelId: 'discord-channel-2',
                guildId: 'guild-1',
            });

            const results = await youtubeManager.getMany({ guildId: 'guild-1' });
            expect(results.length).toBeGreaterThan(0);
        });

        it('should throw error if guildId is missing', async () => {
            await expect(
                youtubeManager.setVideoChannel({
                    youtubeChannelId: 'yt-channel-1',
                    discordChannelId: 'discord-channel-1',
                })
            ).rejects.toThrow('guildId is required');
        });
    });
});
