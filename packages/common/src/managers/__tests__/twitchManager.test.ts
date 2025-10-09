import { describe, it, expect, beforeEach } from 'vitest';
import { configManager } from '../../vitest.setup.js';
import { TwitchStreamConfig } from '../../models/twitch-stream-config.js';

describe('TwitchManager', () => {
    const twitchManager = configManager.twitchManager;

    beforeEach(async () => {
        await twitchManager.removeAll();
    });

    describe('streamExists', () => {
        it('should return true if stream config exists', async () => {
            await TwitchStreamConfig.create({
                twitchUsername: 'streamer1',
                discordChannelId: 'channel-1',
                guildId: 'guild-1',
            });

            const exists = await twitchManager.streamExists(
                'streamer1',
                'channel-1',
                'guild-1'
            );

            expect(exists).toBe(true);
        });

        it('should return false if stream config does not exist', async () => {
            const exists = await twitchManager.streamExists(
                'nonexistent',
                'channel-1',
                'guild-1'
            );

            expect(exists).toBe(false);
        });

        it('should require exact match of all three parameters', async () => {
            await TwitchStreamConfig.create({
                twitchUsername: 'streamer1',
                discordChannelId: 'channel-1',
                guildId: 'guild-1',
            });

            const existsWrongChannel = await twitchManager.streamExists(
                'streamer1',
                'channel-2',
                'guild-1'
            );

            const existsWrongGuild = await twitchManager.streamExists(
                'streamer1',
                'channel-1',
                'guild-2'
            );

            expect(existsWrongChannel).toBe(false);
            expect(existsWrongGuild).toBe(false);
        });
    });

    describe('getAllStreams/removeStream', () => {
        it('getAllStreams returns persisted streams', async () => {
            await TwitchStreamConfig.create({
                twitchUsername: 'streamer2',
                discordChannelId: 'channel-2',
                guildId: 'guild-2',
            });
            const all = await twitchManager.getAllStreams();
            expect(Array.isArray(all)).toBe(true);
            expect(all.length).toBe(1);
        });

        it('removeStream deletes by composite keys', async () => {
            await TwitchStreamConfig.create({
                twitchUsername: 'streamer3',
                discordChannelId: 'channel-3',
                guildId: 'guild-3',
            });
            await twitchManager.removeStream('streamer3', 'channel-3', 'guild-3');
            const remaining = await twitchManager.getManyPlain({ twitchUsername: 'streamer3' } as any);
            expect(remaining.length).toBe(0);
        });
    });
});
