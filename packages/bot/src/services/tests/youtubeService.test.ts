import {jest} from '@jest/globals';
import type {Client} from 'discord.js';

describe('checkAndAnnounceNewVideos', () => {
    let consoleErrorSpy: ReturnType<typeof jest.spyOn>;
    beforeEach(() => {
        consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {
        });
        jest.resetModules();
    });
    afterEach(() => {
        consoleErrorSpy.mockRestore();
        jest.resetModules();
        jest.clearAllMocks();
    });

    it('announces new videos', async () => {
        const mockSend = jest.fn();
        const mockChannel = {type: 0, send: mockSend}; // GuildText
        const mockClient = {
            channels: {cache: {get: jest.fn(() => mockChannel)}}
        };
        jest.unstable_mockModule('@zeffuro/fakegaming-common/dist/managers/configManagerSingleton.js', () => ({
            getConfigManager: () => ({
                youtubeManager: {
                    getAllPlain: jest.fn(() => [{
                        youtubeChannelId: 'UC123',
                        discordChannelId: '4167801562951251571',
                        lastVideoId: 'old',
                        customMessage: null
                    }]),
                    setVideoChannel: jest.fn()
                }
            })
        }));
        jest.unstable_mockModule('rss-parser', () => {
            class MockParser {
                parseURL = jest.fn(() => Promise.resolve({
                    items: [{
                        'yt:videoId': 'new',
                        title: 'Test Video',
                        author: 'Author',
                        link: 'https://youtube.com/watch?v=new',
                        published: new Date().toISOString(),
                        mediaGroup: {},
                        mediaThumbnail: {$: {url: 'https://img.youtube.com/vi/new/0.jpg'}}
                    }]
                }));
            }

            return {
                __esModule: true,
                default: MockParser
            };
        });

        jest.unstable_mockModule('axios', () => ({
            __esModule: true,
            default: {
                get: jest.fn(() => Promise.resolve({data: 'mocked_rss_feed_content'}))
            }
        }));
        const {checkAndAnnounceNewVideos} = await import('../youtubeService.js');
        await checkAndAnnounceNewVideos(mockClient as unknown as Client);
        expect(mockSend).toHaveBeenCalledWith(expect.objectContaining({
            content: expect.stringContaining('youtube.com/watch?v=new')
        }));
    });

    it('does nothing if there are no new videos', async () => {
        const mockSend = jest.fn();
        const mockChannel = {type: 0, send: mockSend};
        const mockClient = {channels: {cache: {get: jest.fn(() => mockChannel)}}};
        jest.unstable_mockModule('@zeffuro/fakegaming-common/dist/managers/configManagerSingleton.js', () => ({
            getConfigManager: () => ({
                youtubeManager: {
                    getAllPlain: jest.fn(() => []),
                    setVideoChannel: jest.fn()
                }
            })
        }));
        jest.unstable_mockModule('rss-parser', () => {
            class MockParser {
                parseURL = jest.fn(() => Promise.resolve({items: []}));
            }

            return {__esModule: true, default: MockParser};
        });
        const {checkAndAnnounceNewVideos} = await import('../youtubeService.js');
        await checkAndAnnounceNewVideos(mockClient as unknown as Client);
        expect(mockSend).not.toHaveBeenCalled();
    });

    it('handles channel not found gracefully', async () => {
        const mockClient = {channels: {cache: {get: jest.fn(() => undefined)}}};
        jest.unstable_mockModule('@zeffuro/fakegaming-common/dist/managers/configManagerSingleton.js', () => ({
            getConfigManager: () => ({
                youtubeManager: {
                    getAllPlain: jest.fn(() => [{
                        youtubeChannelId: 'UC123',
                        discordChannelId: '4167801562951251571',
                        lastVideoId: 'old',
                        customMessage: null
                    }]),
                    setVideoChannel: jest.fn()
                }
            })
        }));
        jest.unstable_mockModule('rss-parser', () => {
            class MockParser {
                parseURL = jest.fn(() => Promise.resolve({items: []}));
            }

            return {__esModule: true, default: MockParser};
        });
        const {checkAndAnnounceNewVideos} = await import('../youtubeService.js');
        await checkAndAnnounceNewVideos(mockClient as unknown as Client);
        // Should not throw
    });

    it('handles API failure gracefully', async () => {
        const mockSend = jest.fn();
        const mockChannel = {type: 0, send: mockSend};
        const mockClient = {channels: {cache: {get: jest.fn(() => mockChannel)}}};
        jest.unstable_mockModule('@zeffuro/fakegaming-common/dist/managers/configManagerSingleton.js', () => ({
            getConfigManager: () => ({
                youtubeManager: {
                    getAllPlain: jest.fn(() => [{
                        youtubeChannelId: 'UC123',
                        discordChannelId: '4167801562951251571',
                        lastVideoId: 'old',
                        customMessage: null
                    }]),
                    setVideoChannel: jest.fn()
                }
            })
        }));
        jest.unstable_mockModule('rss-parser', () => {
            class MockParser {
                parseURL = jest.fn(() => {
                    throw new Error('fail');
                });
            }

            return {__esModule: true, default: MockParser};
        });
        const {checkAndAnnounceNewVideos} = await import('../youtubeService.js');
        await expect(checkAndAnnounceNewVideos(mockClient as unknown as Client)).resolves.not.toThrow();
    });

    it('announces multiple new videos', async () => {
        const mockSend = jest.fn();
        const mockChannel = {type: 0, send: mockSend};
        const mockClient = {channels: {cache: {get: jest.fn(() => mockChannel)}}};
        jest.unstable_mockModule('@zeffuro/fakegaming-common/dist/managers/configManagerSingleton.js', () => ({
            getConfigManager: () => ({
                youtubeManager: {
                    getAllPlain: jest.fn(() => [
                        {
                            youtubeChannelId: 'UC123',
                            discordChannelId: '4167801562951251571',
                            lastVideoId: 'old',
                            customMessage: null
                        },
                        {
                            youtubeChannelId: 'UC456',
                            discordChannelId: '4167801562951251571',
                            lastVideoId: 'old2',
                            customMessage: null
                        }
                    ]),
                    setVideoChannel: jest.fn()
                }
            })
        }));
        jest.unstable_mockModule('rss-parser', () => {
            class MockParser {
                parseURL = jest.fn(() => Promise.resolve({
                    items: [
                        {
                            'yt:videoId': 'new1',
                            title: 'Test1',
                            author: 'A1',
                            link: 'https://youtube.com/watch?v=new1',
                            published: new Date().toISOString(),
                            mediaGroup: {},
                            mediaThumbnail: {$: {url: 'https://img.youtube.com/vi/new1/0.jpg'}}
                        },
                        {
                            'yt:videoId': 'new2',
                            title: 'Test2',
                            author: 'A2',
                            link: 'https://youtube.com/watch?v=new2',
                            published: new Date().toISOString(),
                            mediaGroup: {},
                            mediaThumbnail: {$: {url: 'https://img.youtube.com/vi/new2/0.jpg'}}
                        }
                    ]
                }));
            }

            return {__esModule: true, default: MockParser};
        });
        const {checkAndAnnounceNewVideos} = await import('../youtubeService.js');
        await checkAndAnnounceNewVideos(mockClient as unknown as Client);
        expect(mockSend).toHaveBeenCalledTimes(2);
    });
});