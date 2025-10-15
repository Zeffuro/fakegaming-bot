import { describe, it, expect, beforeEach, vi } from 'vitest';
import { setupServiceTest, createMockTextChannel, createMockTwitchStream, expectSendHasEmbed } from '@zeffuro/fakegaming-common/testing';
import { TextChannel } from 'discord.js';
import { getConfigManager } from '@zeffuro/fakegaming-common/managers';

// Mock Twurple libraries
vi.mock('@twurple/api');
vi.mock('@twurple/auth');

const { mockGetUserByName, mockGetStreamByUserId } = vi.hoisted(() => ({
    mockGetUserByName: vi.fn(),
    mockGetStreamByUserId: vi.fn(),
}));

vi.mock('@twurple/api', () => ({
    ApiClient: vi.fn(() => ({
        users: { getUserByName: mockGetUserByName },
        streams: { getStreamByUserId: mockGetStreamByUserId },
    })),
}));

vi.mock('@twurple/auth', () => ({
    AppTokenAuthProvider: vi.fn(),
    getAppToken: vi.fn(async () => ({
        accessToken: 'test-token',
        refreshToken: null,
        scope: [],
        expiresIn: 3600,
        obtainmentTimestamp: Date.now()
    }))
}));

import { verifyTwitchUser, subscribeAllStreams } from '../twitchService.js';

describe('twitchService', () => {
    let client: Awaited<ReturnType<typeof setupServiceTest>>['client'];
    let configManager: ReturnType<typeof getConfigManager>;

    // --- local helpers (DRY) ---
    const createAndCacheChannel = (id = 'discord-channel-123') => {
        const mockChannel = createMockTextChannel({
            id,
            toString: () => `<#${id}>` as `<#${string}>`,
            valueOf: () => id,
        } as Partial<TextChannel>);
        client.channels.cache.set(id, mockChannel as any);
        return mockChannel;
    };

    const mockTwurple = (user: any, stream: any) => {
        mockGetUserByName.mockResolvedValue(user);
        mockGetStreamByUserId.mockResolvedValue(stream);
    };

    const runSubscribeWith = async (streams: Array<any>) => {
        vi.spyOn(configManager.twitchManager, 'getAllStreams').mockResolvedValue(streams as any);
        await subscribeAllStreams(client);
    };

    beforeEach(async () => {
        const setup = await setupServiceTest();
        client = setup.client;
        configManager = setup.configManager;

        vi.clearAllMocks();
        process.env.TWITCH_CLIENT_ID = 'test-client-id';
        process.env.TWITCH_CLIENT_SECRET = 'test-client-secret';
    });

    describe('verifyTwitchUser', () => {
        it('should return true for existing user', async () => {
            mockGetUserByName.mockResolvedValue({ id: '12345', name: 'testuser' });

            const result = await verifyTwitchUser('testuser');

            expect(result).toBe(true);
            expect(mockGetUserByName).toHaveBeenCalledWith('testuser');
        });

        it('should return false for non-existent user', async () => {
            mockGetUserByName.mockResolvedValue(null);

            const result = await verifyTwitchUser('invaliduser');

            expect(result).toBe(false);
        });
    });

    describe('subscribeAllStreams', () => {
        it('should announce when stream goes live', async () => {
            const mockChannel = createAndCacheChannel('discord-channel-123');
            const twitchStream = createMockTwitchStream({
                id: 'stream-1' as any, // TwitchStreamConfig uses number for id
                twitchUsername: 'teststreamer',
                discordChannelId: 'discord-channel-123',
                isLive: false,
                guildId: 'guild-1'
            });

            const mockTwitchUser = {
                id: 'twitch-user-123',
                name: 'teststreamer',
                displayName: 'TestStreamer',
                profilePictureUrl: 'https://example.com/avatar.png'
            };
            const mockStreamData = {
                id: 'stream-123',
                title: 'Test Stream',
                viewers: 100,
                thumbnailUrl: 'https://example.com/thumb-{width}x{height}.jpg',
            };

            mockTwurple(mockTwitchUser, mockStreamData);
            vi.spyOn(configManager.notificationsManager, 'has').mockResolvedValue(false);
            vi.spyOn(configManager.notificationsManager, 'recordIfNew').mockResolvedValue({ created: true, record: {} as any });

            await runSubscribeWith([twitchStream]);

            expectSendHasEmbed(mockChannel);
            expect(twitchStream.isLive).toBe(true);
            expect(twitchStream.save).toHaveBeenCalled();
            expect(configManager.notificationsManager.recordIfNew).toHaveBeenCalledWith(expect.objectContaining({
                provider: 'twitch', eventId: 'stream-123', guildId: 'guild-1'
            }));
        });

        it('should update status when stream goes offline', async () => {
            const twitchStream = createMockTwitchStream({
                id: 'stream-2' as any, // TwitchStreamConfig uses number for id
                twitchUsername: 'teststreamer',
                isLive: true,
            });

            const mockTwitchUser = { id: 'twitch-user-123', name: 'teststreamer' };

            mockTwurple(mockTwitchUser, null); // Stream is offline
            await runSubscribeWith([twitchStream]);

            expect(twitchStream.isLive).toBe(false);
            expect(twitchStream.save).toHaveBeenCalled();
        });

        it('should not announce if stream is already marked as live', async () => {
            const mockChannel = createAndCacheChannel('discord-channel-123');
            const twitchStream = createMockTwitchStream({
                id: 'stream-3' as any, // TwitchStreamConfig uses number for id
                twitchUsername: 'teststreamer',
                discordChannelId: 'discord-channel-123',
                isLive: true,
            });

            const mockTwitchUser = { id: 'twitch-user-123', name: 'teststreamer' };
            const mockStreamData = { id: 'stream-123', title: 'Test Stream', viewers: 100 };

            mockTwurple(mockTwitchUser, mockStreamData);
            await runSubscribeWith([twitchStream]);

            expect(mockChannel.send).not.toHaveBeenCalled();
        });

        it('should use custom message if provided', async () => {
            const mockChannel = createAndCacheChannel('discord-channel-123');
            const twitchStream = createMockTwitchStream({
                id: 'stream-4' as any, // TwitchStreamConfig uses number for id
                twitchUsername: 'teststreamer',
                discordChannelId: 'discord-channel-123',
                isLive: false,
                customMessage: 'Check out {streamer} live now!',
                guildId: 'guild-1'
            });

            const mockTwitchUser = {
                id: 'twitch-user-123',
                name: 'teststreamer',
                displayName: 'TestStreamer',
                profilePictureUrl: 'https://example.com/avatar.png'
            };
            const mockStreamData = { id: 'stream-123', title: 'Test Stream', viewers: 100 };

            mockTwurple(mockTwitchUser, mockStreamData);
            vi.spyOn(configManager.notificationsManager, 'has').mockResolvedValue(false);
            vi.spyOn(configManager.notificationsManager, 'recordIfNew').mockResolvedValue({ created: true, record: {} as any });
            await runSubscribeWith([twitchStream]);

            expect(mockChannel.send).toHaveBeenCalledWith(
                expect.objectContaining({
                    content: expect.stringContaining('Check out TestStreamer live now!'),
                })
            );
        });

        it('should handle errors gracefully', async () => {
            const twitchStream = createMockTwitchStream({
                id: 'stream-5' as any,
                twitchUsername: 'errorstreamer',
            });

            mockGetUserByName.mockRejectedValue(new Error('API error'));

            vi.spyOn(configManager.twitchManager, 'getAllStreams').mockResolvedValue([twitchStream as any]);

            const glb = (globalThis as Record<string, unknown>);
            const sharedLogger = (glb.__TEST_LOGGER__ as { error: (...args: unknown[]) => void; info?: (...args: unknown[]) => void; warn?: (...args: unknown[]) => void; debug?: (...args: unknown[]) => void })
                ?? { error: vi.fn(), info: vi.fn(), warn: vi.fn(), debug: vi.fn() };

            await subscribeAllStreams(client, { logger: sharedLogger as any });

            expect(sharedLogger.error).toHaveBeenCalledWith(
                expect.objectContaining({ service: 'subscribeAllStreams', err: expect.any(Error) }),
                expect.stringContaining('Error in subscribeAllStreams')
            );
        });

        it('should skip streams with no user found', async () => {
            const twitchStream = createMockTwitchStream({
                id: 'stream-6' as any,
                twitchUsername: 'nonexistent',
            });

            mockGetUserByName.mockResolvedValue(null);

            await runSubscribeWith([twitchStream]);

            expect(mockGetStreamByUserId).not.toHaveBeenCalled();
        });

        it('should not announce duplicate event when already recorded', async () => {
            const mockChannel = createAndCacheChannel('discord-channel-dup');
            const twitchStream = createMockTwitchStream({
                id: 'stream-7' as any,
                twitchUsername: 'duptest',
                discordChannelId: 'discord-channel-dup',
                isLive: false,
                guildId: 'guild-dup'
            });

            const mockTwitchUser = { id: 'twitch-user-dup', name: 'duptest', displayName: 'DupTest' };
            const mockStreamData = { id: 'event-dup', title: 'Dup Stream', viewers: 10 };

            mockTwurple(mockTwitchUser, mockStreamData);
            vi.spyOn(configManager.notificationsManager, 'has').mockResolvedValue(true);

            await runSubscribeWith([twitchStream]);

            expect(mockChannel.send).not.toHaveBeenCalled();
            expect(twitchStream.isLive).toBe(true);
            expect(twitchStream.save).toHaveBeenCalled();
        });

        it('should suppress during quiet hours and still set isLive/save', async () => {
            const mockChannel = createAndCacheChannel('discord-channel-quiet');
            const twitchStream = createMockTwitchStream({
                id: 'stream-q1' as any,
                twitchUsername: 'quietstreamer',
                discordChannelId: 'discord-channel-quiet',
                isLive: false,
                guildId: 'guild-q',
            });
            (twitchStream as any).quietHoursStart = '00:00';
            (twitchStream as any).quietHoursEnd = '00:00'; // full-day quiet per implementation

            const mockTwitchUser = { id: 'twitch-user-q', name: 'quietstreamer', displayName: 'Quiet' };
            const mockStreamData = { id: 'event-q', title: 'Quiet Stream', viewers: 1 };

            mockTwurple(mockTwitchUser, mockStreamData);

            await runSubscribeWith([twitchStream]);

            expect(mockChannel.send).not.toHaveBeenCalled();
            expect(twitchStream.isLive).toBe(true);
            expect(twitchStream.save).toHaveBeenCalled();
        });

        it('should suppress due to cooldown and not record notification', async () => {
            const mockChannel = createAndCacheChannel('discord-channel-cd');
            const now = new Date();
            const tenMinutesAgo = new Date(now.getTime() - 10 * 60_000);

            const twitchStream = createMockTwitchStream({
                id: 'stream-cd' as any,
                twitchUsername: 'cooldowner',
                discordChannelId: 'discord-channel-cd',
                isLive: false,
                guildId: 'guild-cd',
            });
            (twitchStream as any).cooldownMinutes = 60;
            (twitchStream as any).lastNotifiedAt = tenMinutesAgo;

            const mockTwitchUser = { id: 'twitch-user-cd', name: 'cooldowner', displayName: 'CD' };
            const mockStreamData = { id: 'event-cd', title: 'CD Stream', viewers: 42 };

            mockTwurple(mockTwitchUser, mockStreamData);
            const spyHas = vi.spyOn(configManager.notificationsManager, 'has').mockResolvedValue(false);
            const spyRecord = vi.spyOn(configManager.notificationsManager, 'recordIfNew').mockResolvedValue({ created: true, record: {} as any });

            await runSubscribeWith([twitchStream]);

            expect(spyHas).toHaveBeenCalledWith('twitch', 'event-cd');
            expect(spyRecord).not.toHaveBeenCalled();
            expect(mockChannel.send).not.toHaveBeenCalled();
            expect(twitchStream.isLive).toBe(true);
            expect(twitchStream.save).toHaveBeenCalled();
        });

        it('should not duplicate on flap (offline→online with same eventId)', async () => {
            const mockChannel = createAndCacheChannel('discord-channel-flap');
            const twitchStream = createMockTwitchStream({
                id: 'stream-flap' as any,
                twitchUsername: 'flapper',
                discordChannelId: 'discord-channel-flap',
                isLive: false,
                guildId: 'guild-flap'
            });

            const mockTwitchUser = { id: 'twitch-user-flap', name: 'flapper', displayName: 'Flapper' };
            const mockStreamData = { id: 'event-flap', title: 'Flap Stream', viewers: 77 };

            // First run: online -> should announce and record
            mockTwurple(mockTwitchUser, mockStreamData);
            const spyHas = vi.spyOn(configManager.notificationsManager, 'has');
            spyHas.mockResolvedValueOnce(false); // first event is new
            const spyRecord = vi.spyOn(configManager.notificationsManager, 'recordIfNew').mockResolvedValue({ created: true, record: {} as any });
            vi.spyOn(configManager.twitchManager, 'getAllStreams').mockResolvedValue([twitchStream as any]);
            await subscribeAllStreams(client);
            expectSendHasEmbed(mockChannel);

            // Second run: offline -> should set isLive=false, no message
            mockTwurple(mockTwitchUser, null);
            await subscribeAllStreams(client);
            expect(twitchStream.isLive).toBe(false);
            expect(mockChannel.send).toHaveBeenCalledTimes(1); // still only one announcement

            // Third run: online again with SAME event id -> should NOT announce (dedupe)
            mockTwurple(mockTwitchUser, mockStreamData);
            spyHas.mockResolvedValueOnce(true); // already recorded event id
            await subscribeAllStreams(client);

            // Only one send overall
            expect(mockChannel.send).toHaveBeenCalledTimes(1);
            expect(twitchStream.isLive).toBe(true);
            expect(spyRecord).toHaveBeenCalledTimes(1);
        });
    });
});
