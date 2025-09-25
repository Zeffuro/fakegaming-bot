import {jest} from '@jest/globals';
import type {Client} from 'discord.js';

describe('subscribeAllStreams', () => {
    it('announces live Twitch streams', async () => {
        const mockSend = jest.fn();
        const mockChannel = {type: 0, send: mockSend}; // GuildText
        const mockClient = {
            channels: {cache: {get: jest.fn(() => mockChannel)}}
        };
        jest.unstable_mockModule('@zeffuro/fakegaming-common/dist/managers/configManagerSingleton.js', () => ({
            getConfigManager: () => ({
                twitchManager: {
                    getAllPlain: jest.fn(() => [{
                        twitchUsername: 'streamer',
                        discordChannelId: '456',
                        customMessage: null
                    }])
                }
            })
        }));
        jest.unstable_mockModule('@twurple/api', () => ({
            ApiClient: jest.fn(() => ({
                users: {
                    getUserByName: jest.fn(() => Promise.resolve({
                        id: 'id1',
                        displayName: 'Streamer',
                        name: 'streamer',
                        profilePictureUrl: 'https://twitch.tv/pic'
                    }))
                },
                streams: {
                    getStreamByUserId: jest.fn(() => Promise.resolve({
                        title: 'Live!',
                        viewers: 100,
                        thumbnailUrl: 'https://twitch.tv/thumb/{width}x{height}'
                    }))
                }
            }))
        }));
        const {subscribeAllStreams} = await import('../twitchService.js');
        await subscribeAllStreams(mockClient as unknown as Client);
        expect(mockSend).toHaveBeenCalledWith(expect.objectContaining({
            content: expect.stringContaining('Streamer is now live')
        }));
    });
});