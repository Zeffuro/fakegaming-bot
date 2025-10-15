import { describe, it, expect, beforeEach, vi } from 'vitest';
import { setupServiceTest, createMockTextChannel } from '@zeffuro/fakegaming-common/testing';
import { TextChannel } from 'discord.js';
import { getConfigManager } from '@zeffuro/fakegaming-common/managers';

// Mock axios
vi.mock('axios');

const { mockAxiosGet, mockParserParseURL } = vi.hoisted(() => ({
    mockAxiosGet: vi.fn(),
    mockParserParseURL: vi.fn(),
}));

import axios from 'axios';
vi.mocked(axios.get).mockImplementation(mockAxiosGet);

vi.mock('rss-parser', () => ({
    default: vi.fn(() => ({
        parseURL: mockParserParseURL,
    })),
}));

import { getYoutubeChannelId, getYoutubeChannelFeed, checkAndAnnounceNewVideos } from '../youtubeService.js';

describe('youtubeService', () => {
    let client: Awaited<ReturnType<typeof setupServiceTest>>['client'];
    let configManager: ReturnType<typeof getConfigManager>;

    // --- local helpers (DRY) ---
    const createAndCacheChannel = (id = 'discord-channel-123') => {
        const mockChannel = createMockTextChannel({
            id,
            toString: () => `<#${id}>` as `<#${string}>`,
            valueOf: () => id,
        } as Partial<TextChannel>);
        client.channels.cache.set(mockChannel.id, mockChannel as any);
        return mockChannel;
    };

    const runCheckWith = async (channels: Array<any>, feedItems: Array<any>) => {
        vi.spyOn(configManager.youtubeManager, 'getAllChannels').mockResolvedValue(channels as any);
        mockParserParseURL.mockResolvedValue({ items: feedItems });
        await checkAndAnnounceNewVideos(client);
    };

    const expectAnnouncedAndSaved = (channel: any, cfg: { lastVideoId: string | null; save: any }, expectedVideoId: string) => {
        expect(channel.send).toHaveBeenCalled();
        expect(cfg.save).toHaveBeenCalled();
        expect(cfg.lastVideoId).toBe(expectedVideoId);
    };

    beforeEach(async () => {
        const setup = await setupServiceTest();
        client = setup.client;
        configManager = setup.configManager;

        vi.clearAllMocks();
        process.env.YOUTUBE_API_KEY = 'test-api-key';
    });

    describe('getYoutubeChannelId', () => {
        it('should fetch channel ID from handle', async () => {
            const handle = '@testchannel';
            mockAxiosGet.mockResolvedValue({
                data: {
                    items: [{ id: 'UC1234567890123456789012' }],
                },
            });

            const result = await getYoutubeChannelId(handle);
            expect(result).toBe('UC1234567890123456789012');
            expect(mockAxiosGet).toHaveBeenCalledWith(
                expect.stringContaining('forHandle=testchannel')
            );
        });

        it('should return null for invalid channel', async () => {
            mockAxiosGet.mockResolvedValue({ data: { items: [] } });

            const result = await getYoutubeChannelId('@invalid');
            expect(result).toBeNull();
        });

        it('should fetch channel ID from username', async () => {
            mockAxiosGet.mockResolvedValue({
                data: {
                    items: [{ id: 'UC9876543210987654321098' }],
                },
            });

            const result = await getYoutubeChannelId('testuser');
            expect(result).toBe('UC9876543210987654321098');
            expect(mockAxiosGet).toHaveBeenCalledWith(
                expect.stringContaining('forUsername=testuser')
            );
        });

        it('should validate channel ID format and return if valid', async () => {
            const channelId = 'UC1234567890123456789012';
            mockParserParseURL.mockResolvedValue({
                items: [{ 'yt:videoId': 'video123', title: 'Test Video' }],
            });

            const result = await getYoutubeChannelId(channelId);
            expect(result).toBe(channelId);
        });

        it('should return null if channel ID format is valid but feed is empty', async () => {
            const channelId = 'UC1234567890123456789012';
            mockParserParseURL.mockResolvedValue({ items: [] });

            const result = await getYoutubeChannelId(channelId);
            expect(result).toBeNull();
        });

        it('should handle API errors', async () => {
            const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
            mockAxiosGet.mockRejectedValue(new Error('API error'));

            const result = await getYoutubeChannelId('@error');
            expect(result).toBeNull();
            expect(spy).toHaveBeenCalled();
            spy.mockRestore();
        });
    });

    describe('getYoutubeChannelFeed', () => {
        it('should fetch channel feed successfully', async () => {
            const mockFeed = {
                items: [
                    { 'yt:videoId': 'video1', title: 'Video 1', link: 'https://youtube.com/watch?v=video1' },
                    { 'yt:videoId': 'video2', title: 'Video 2', link: 'https://youtube.com/watch?v=video2' },
                ],
            };
            mockParserParseURL.mockResolvedValue(mockFeed);

            const result = await getYoutubeChannelFeed('UC1234567890123456789012');
            expect(result).toEqual(mockFeed.items);
        });

        it('should return null for empty feed', async () => {
            mockParserParseURL.mockResolvedValue({ items: [] });

            const result = await getYoutubeChannelFeed('UC1234567890123456789012');
            expect(result).toBeNull();
        });

        it('should handle feed parsing errors', async () => {
            const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
            mockParserParseURL.mockRejectedValue(new Error('Parse error'));

            const result = await getYoutubeChannelFeed('UC1234567890123456789012');
            expect(result).toBeNull();
            expect(spy).toHaveBeenCalled();
            spy.mockRestore();
        });
    });

    describe('checkAndAnnounceNewVideos', () => {
        it('should announce new videos to subscribed channels and record notification', async () => {
            const mockChannel = createAndCacheChannel('discord-channel-123');

            const ytChannel = {
                youtubeChannelId: 'UC1234567890123456789012',
                discordChannelId: 'discord-channel-123',
                lastVideoId: null as string | null,
                customMessage: null as string | null,
                save: vi.fn(),
            };

            const mockFeed = [
                {
                    'yt:videoId': 'new-video',
                    title: 'New Video',
                    link: 'https://youtube.com/watch?v=new-video',
                    author: 'Test Channel',
                    published: new Date().toISOString(),
                    mediaThumbnail: { $: { url: 'https://example.com/thumb.jpg' } },
                },
            ];

            vi.spyOn(configManager.notificationsManager, 'has').mockResolvedValue(false);
            vi.spyOn(configManager.notificationsManager, 'recordIfNew').mockResolvedValue({ created: true, record: {} as any });
            await runCheckWith([ytChannel], mockFeed);

            expectAnnouncedAndSaved(mockChannel, ytChannel, 'new-video');
            expect(configManager.notificationsManager.recordIfNew).toHaveBeenCalledWith(expect.objectContaining({
                provider: 'youtube', eventId: 'new-video'
            }));
        });

        it('should not announce already seen videos', async () => {
            const mockChannel = createAndCacheChannel('discord-channel-123');

            const ytChannel = {
                youtubeChannelId: 'UC1234567890123456789012',
                discordChannelId: 'discord-channel-123',
                lastVideoId: 'video1',
                customMessage: null as string | null,
                save: vi.fn(),
            };

            const mockFeed = [
                { 'yt:videoId': 'video1', title: 'Old Video', link: 'https://youtube.com/watch?v=video1' },
            ];

            await runCheckWith([ytChannel], mockFeed);

            expect(mockChannel.send).not.toHaveBeenCalled();
        });

        it('should use custom message if provided', async () => {
            const mockChannel = createAndCacheChannel('discord-channel-123');

            const ytChannel = {
                youtubeChannelId: 'UC1234567890123456789012',
                discordChannelId: 'discord-channel-123',
                lastVideoId: null as string | null,
                customMessage: 'New video: {title}',
                save: vi.fn(),
            };

            const mockFeed = [
                {
                    'yt:videoId': 'new-video',
                    title: 'Custom Title',
                    link: 'https://youtube.com/watch?v=new-video',
                    author: 'Test Channel',
                    published: new Date().toISOString(),
                    mediaThumbnail: { $: { url: 'https://example.com/thumb.jpg' } },
                },
            ];

            vi.spyOn(configManager.notificationsManager, 'has').mockResolvedValue(false);
            vi.spyOn(configManager.notificationsManager, 'recordIfNew').mockResolvedValue({ created: true, record: {} as any });
            await runCheckWith([ytChannel], mockFeed);

            expect(mockChannel.send).toHaveBeenCalledWith(
                expect.objectContaining({
                    content: expect.stringContaining('New video: Custom Title'),
                })
            );
        });

        it('should handle multiple new videos in order', async () => {
            const mockChannel = createAndCacheChannel('discord-channel-123');

            const ytChannel = {
                youtubeChannelId: 'UC1234567890123456789012',
                discordChannelId: 'discord-channel-123',
                lastVideoId: 'video1',
                customMessage: null as string | null,
                save: vi.fn(),
            };

            const mockFeed = [
                {
                    'yt:videoId': 'video3',
                    title: 'Video 3',
                    link: 'https://youtube.com/watch?v=video3',
                    author: 'Test Channel',
                    published: new Date().toISOString(),
                },
                {
                    'yt:videoId': 'video2',
                    title: 'Video 2',
                    link: 'https://youtube.com/watch?v=video2',
                    author: 'Test Channel',
                    published: new Date().toISOString(),
                },
                {
                    'yt:videoId': 'video1',
                    title: 'Video 1',
                    link: 'https://youtube.com/watch?v=video1',
                    author: 'Test Channel',
                    published: new Date().toISOString(),
                },
            ];

            await runCheckWith([ytChannel], mockFeed);

            expect(mockChannel.send).toHaveBeenCalledTimes(2);
            // After announcing video2 and video3, lastVideoId should be the first item in the array
            expect(ytChannel.lastVideoId).toBe('video2');
        });

        it('should skip announcing when notification already recorded and still advance lastVideoId', async () => {
            const mockChannel = createAndCacheChannel('discord-channel-dup');

            const ytChannel = {
                youtubeChannelId: 'UCdup',
                discordChannelId: 'discord-channel-dup',
                lastVideoId: null as string | null,
                customMessage: null as string | null,
                save: vi.fn(),
            };

            const mockFeed = [
                { 'yt:videoId': 'dup-video', title: 'Dup', link: 'https://youtube.com/watch?v=dup-video', author: 'Chan' }
            ];

            vi.spyOn(configManager.notificationsManager, 'has').mockResolvedValue(true);

            await runCheckWith([ytChannel], mockFeed);

            expect(mockChannel.send).not.toHaveBeenCalled();
            // lastVideoId should still be updated to the new video to avoid reprocessing
            expect(ytChannel.lastVideoId).toBe('dup-video');
            expect(ytChannel.save).toHaveBeenCalled();
        });

        it('should suppress during quiet hours but still advance lastVideoId and save', async () => {
            const mockChannel = createAndCacheChannel('discord-channel-quiet');

            const ytChannel = {
                youtubeChannelId: 'UCquiet',
                discordChannelId: 'discord-channel-quiet',
                lastVideoId: null as string | null,
                customMessage: null as string | null,
                quietHoursStart: '00:00',
                quietHoursEnd: '00:00', // full-day quiet per implementation
                save: vi.fn(),
            };

            const mockFeed = [
                { 'yt:videoId': 'quiet-video', title: 'Quiet Video', link: 'https://youtube.com/watch?v=quiet-video', author: 'Chan' }
            ];

            await runCheckWith([ytChannel], mockFeed);

            expect(mockChannel.send).not.toHaveBeenCalled();
            expect(ytChannel.lastVideoId).toBe('quiet-video');
            expect(ytChannel.save).toHaveBeenCalled();
        });

        it('should suppress due to cooldown and still advance lastVideoId', async () => {
            const mockChannel = createAndCacheChannel('discord-channel-cd');

            const now = new Date();
            const tenMinutesAgo = new Date(now.getTime() - 10 * 60_000);

            const ytChannel = {
                youtubeChannelId: 'UCcd',
                discordChannelId: 'discord-channel-cd',
                lastVideoId: null as string | null,
                customMessage: null as string | null,
                cooldownMinutes: 60,
                lastNotifiedAt: tenMinutesAgo,
                save: vi.fn(),
            };

            const mockFeed = [
                { 'yt:videoId': 'cd-video', title: 'CD Video', link: 'https://youtube.com/watch?v=cd-video', author: 'Chan' }
            ];

            // Spy notifications manager to ensure no record is created when suppressed
            const spyHas = vi.spyOn(configManager.notificationsManager, 'has').mockResolvedValue(false);
            const spyRecord = vi.spyOn(configManager.notificationsManager, 'recordIfNew').mockResolvedValue({ created: true, record: {} as any });

            await runCheckWith([ytChannel], mockFeed);

            expect(spyHas).toHaveBeenCalledWith('youtube', 'cd-video');
            expect(spyRecord).not.toHaveBeenCalled();
            expect(mockChannel.send).not.toHaveBeenCalled();
            expect(ytChannel.lastVideoId).toBe('cd-video');
            expect(ytChannel.save).toHaveBeenCalled();
        });

        it('falls back to standard YouTube thumbnail when feed has no media:thumbnail', async () => {
            const channel = createAndCacheChannel('discord-channel-fallback');

            const ytChannel = {
                youtubeChannelId: 'UCfallback',
                discordChannelId: 'discord-channel-fallback',
                lastVideoId: null as string | null,
                customMessage: null as string | null,
                save: vi.fn(),
            };

            const id = 'ouJEu9LcUaU';
            const mockFeed = [
                {
                    'yt:videoId': id,
                    title: 'No Thumb In Feed',
                    link: `https://www.youtube.com/watch?v=${id}`,
                    author: 'Qucee',
                    published: new Date().toISOString(),
                    // no mediaThumbnail
                },
            ];

            vi.spyOn(configManager.notificationsManager, 'has').mockResolvedValue(false);
            vi.spyOn(configManager.notificationsManager, 'recordIfNew').mockResolvedValue({ created: true, record: {} as any });

            await runCheckWith([ytChannel], mockFeed);

            expect(channel.send).toHaveBeenCalledTimes(1);
            const sendArg = (channel.send as unknown as ReturnType<typeof vi.fn>).mock.calls[0][0];
            const embed = sendArg.embeds[0];
            // EmbedBuilder stores data on `.data`
            expect(embed.data.image?.url).toBe(`https://i.ytimg.com/vi/${id}/hqdefault.jpg`);
        });

        it('uses media:group media:thumbnail when present', async () => {
            const channel = createAndCacheChannel('discord-channel-group');

            const ytChannel = {
                youtubeChannelId: 'UCgroup',
                discordChannelId: 'discord-channel-group',
                lastVideoId: null as string | null,
                customMessage: null as string | null,
                save: vi.fn(),
            };

            const id = 'an3f4yZJMco';
            const groupThumb = `https://i2.ytimg.com/vi/${id}/hqdefault.jpg`;
            const mockFeed = [
                {
                    'yt:videoId': id,
                    title: 'Thumb in media:group',
                    link: `https://www.youtube.com/watch?v=${id}`,
                    author: 'Qucee',
                    published: new Date().toISOString(),
                    mediaGroup: {
                        ['media:thumbnail']: { url: groupThumb },
                    },
                },
            ];

            vi.spyOn(configManager.notificationsManager, 'has').mockResolvedValue(false);
            vi.spyOn(configManager.notificationsManager, 'recordIfNew').mockResolvedValue({ created: true, record: {} as any });

            await runCheckWith([ytChannel], mockFeed);

            expect(channel.send).toHaveBeenCalledTimes(1);
            const sendArg = (channel.send as unknown as ReturnType<typeof vi.fn>).mock.calls[0][0];
            const embed = sendArg.embeds[0];
            expect(embed.data.image?.url).toBe(groupThumb);
        });
    });
});
