import {jest} from '@jest/globals';

describe('checkAndAnnounceNewVideos', () => {
    it('announces new videos', async () => {
        const mockSend = jest.fn();
        const mockChannel = {type: 0, send: mockSend}; // GuildText
        const mockClient = {
            channels: {cache: {get: jest.fn(() => mockChannel)}}
        };
        jest.unstable_mockModule('../../../../common/src/managers/configManagerSingleton.js', () => ({
            configManager: {
                youtubeManager: {
                    getAll: jest.fn(() => [{
                        youtubeChannelId: 'UC123',
                        discordChannelId: '4167801562951251571',
                        lastVideoId: 'old',
                        customMessage: null
                    }]),
                    setVideoChannel: jest.fn()
                }
            }
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
        await checkAndAnnounceNewVideos(mockClient as any);
        expect(mockSend).toHaveBeenCalledWith(expect.objectContaining({
            content: expect.stringContaining('youtube.com/watch?v=new')
        }));
    });
});