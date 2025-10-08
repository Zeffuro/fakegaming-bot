import { describe, it, expect, beforeEach, vi } from 'vitest';
import { setupServiceTest, createMockTextChannel, createMockTwitchStream } from '@zeffuro/fakegaming-common/testing';
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
}));

import { verifyTwitchUser, subscribeAllStreams } from '../twitchService.js';

describe('twitchService', () => {
    let client: Awaited<ReturnType<typeof setupServiceTest>>['client'];
    let configManager: ReturnType<typeof getConfigManager>;

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
            const mockChannel = createMockTextChannel({
                id: 'discord-channel-123',
                toString: () => '<#discord-channel-123>' as `<#${string}>`,
                valueOf: () => 'discord-channel-123',
            } as Partial<TextChannel>);
            const twitchStream = createMockTwitchStream({
                id: 'stream-1' as any, // TwitchStreamConfig uses number for id
                twitchUsername: 'teststreamer',
                discordChannelId: 'discord-channel-123',
                isLive: false,
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

            mockGetUserByName.mockResolvedValue(mockTwitchUser);
            mockGetStreamByUserId.mockResolvedValue(mockStreamData);

            vi.spyOn(configManager.twitchManager, 'getAllStreams').mockResolvedValue([twitchStream as any]);
            client.channels.cache.set('discord-channel-123', mockChannel as any);

            await subscribeAllStreams(client);

            expect(mockChannel.send).toHaveBeenCalledWith(
                expect.objectContaining({
                    embeds: expect.arrayContaining([expect.any(Object)]),
                })
            );
            expect(twitchStream.isLive).toBe(true);
            expect(twitchStream.save).toHaveBeenCalled();
        });

        it('should update status when stream goes offline', async () => {
            const twitchStream = createMockTwitchStream({
                id: 'stream-2' as any, // TwitchStreamConfig uses number for id
                twitchUsername: 'teststreamer',
                isLive: true,
            });

            const mockTwitchUser = { id: 'twitch-user-123', name: 'teststreamer' };

            mockGetUserByName.mockResolvedValue(mockTwitchUser);
            mockGetStreamByUserId.mockResolvedValue(null); // Stream is offline

            vi.spyOn(configManager.twitchManager, 'getAllStreams').mockResolvedValue([twitchStream as any]);

            await subscribeAllStreams(client);

            expect(twitchStream.isLive).toBe(false);
            expect(twitchStream.save).toHaveBeenCalled();
        });

        it('should not announce if stream is already marked as live', async () => {
            const mockChannel = createMockTextChannel({
                id: 'discord-channel-123',
                toString: () => '<#discord-channel-123>' as `<#${string}>`,
                valueOf: () => 'discord-channel-123',
            } as Partial<TextChannel>);
            const twitchStream = createMockTwitchStream({
                id: 'stream-3' as any, // TwitchStreamConfig uses number for id
                twitchUsername: 'teststreamer',
                discordChannelId: 'discord-channel-123',
                isLive: true,
            });

            const mockTwitchUser = { id: 'twitch-user-123', name: 'teststreamer' };
            const mockStreamData = { id: 'stream-123', title: 'Test Stream', viewers: 100 };

            mockGetUserByName.mockResolvedValue(mockTwitchUser);
            mockGetStreamByUserId.mockResolvedValue(mockStreamData);

            vi.spyOn(configManager.twitchManager, 'getAllStreams').mockResolvedValue([twitchStream as any]);
            client.channels.cache.set('discord-channel-123', mockChannel as any);

            await subscribeAllStreams(client);

            expect(mockChannel.send).not.toHaveBeenCalled();
        });

        it('should use custom message if provided', async () => {
            const mockChannel = createMockTextChannel({
                id: 'discord-channel-123',
                toString: () => '<#discord-channel-123>' as `<#${string}>`,
                valueOf: () => 'discord-channel-123',
            } as Partial<TextChannel>);
            const twitchStream = createMockTwitchStream({
                id: 'stream-4' as any, // TwitchStreamConfig uses number for id
                twitchUsername: 'teststreamer',
                discordChannelId: 'discord-channel-123',
                isLive: false,
                customMessage: 'Check out {streamer} live now!',
            });

            const mockTwitchUser = {
                id: 'twitch-user-123',
                name: 'teststreamer',
                displayName: 'TestStreamer',
                profilePictureUrl: 'https://example.com/avatar.png'
            };
            const mockStreamData = { id: 'stream-123', title: 'Test Stream', viewers: 100 };

            mockGetUserByName.mockResolvedValue(mockTwitchUser);
            mockGetStreamByUserId.mockResolvedValue(mockStreamData);

            vi.spyOn(configManager.twitchManager, 'getAllStreams').mockResolvedValue([twitchStream as any]);
            client.channels.cache.set('discord-channel-123', mockChannel as any);

            await subscribeAllStreams(client);

            expect(mockChannel.send).toHaveBeenCalledWith(
                expect.objectContaining({
                    content: expect.stringContaining('Check out TestStreamer live now!'),
                })
            );
        });

        it('should handle errors gracefully', async () => {
            const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
            const twitchStream = createMockTwitchStream({
                id: 'stream-5' as any,
                twitchUsername: 'errorstreamer',
            });

            mockGetUserByName.mockRejectedValue(new Error('API error'));

            vi.spyOn(configManager.twitchManager, 'getAllStreams').mockResolvedValue([twitchStream as any]);

            await subscribeAllStreams(client);

            expect(spy).toHaveBeenCalled();
            spy.mockRestore();
        });

        it('should skip streams with no user found', async () => {
            const twitchStream = createMockTwitchStream({
                id: 'stream-6' as any,
                twitchUsername: 'nonexistent',
            });

            mockGetUserByName.mockResolvedValue(null);

            vi.spyOn(configManager.twitchManager, 'getAllStreams').mockResolvedValue([twitchStream as any]);

            await subscribeAllStreams(client);

            expect(mockGetStreamByUserId).not.toHaveBeenCalled();
        });
    });
});
