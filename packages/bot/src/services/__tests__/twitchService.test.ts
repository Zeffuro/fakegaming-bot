import {jest} from '@jest/globals';
import type {Client} from 'discord.js';

describe('subscribeAllStreams', () => {
    let consoleErrorSpy: ReturnType<typeof jest.spyOn>;
    beforeEach(() => {
        consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {
        });
        jest.resetModules();
        jest.clearAllMocks();
    });
    afterEach(() => {
        consoleErrorSpy.mockRestore();
        jest.resetModules();
        jest.clearAllMocks();
    });

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

    it('does nothing if there are no streams to announce', async () => {
        const mockSend = jest.fn();
        const mockChannel = {type: 0, send: mockSend};
        const mockClient = {channels: {cache: {get: jest.fn(() => mockChannel)}}};
        jest.unstable_mockModule('@zeffuro/fakegaming-common/dist/managers/configManagerSingleton.js', () => ({
            getConfigManager: () => ({
                twitchManager: {getAllPlain: jest.fn(() => [])}
            })
        }));
        const {subscribeAllStreams} = await import('../twitchService.js');
        await subscribeAllStreams(mockClient as unknown as Client);
        expect(mockSend).not.toHaveBeenCalled();
    });

    it('handles channel not found gracefully', async () => {
        const mockClient = {channels: {cache: {get: jest.fn(() => undefined)}}};
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
        const {subscribeAllStreams} = await import('../twitchService.js');
        await subscribeAllStreams(mockClient as unknown as Client);
        // Should not throw
    });

    it('handles API failure gracefully', async () => {
        const mockSend = jest.fn();
        const mockChannel = {type: 0, send: mockSend};
        const mockClient = {channels: {cache: {get: jest.fn(() => mockChannel)}}};
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
                    getUserByName: jest.fn(() => {
                        throw new Error('fail');
                    })
                },
                streams: {getStreamByUserId: jest.fn(() => Promise.resolve(null))}
            }))
        }));
        const {subscribeAllStreams} = await import('../twitchService.js');
        await expect(subscribeAllStreams(mockClient as unknown as Client)).resolves.not.toThrow();
    });

    it('announces multiple live streams', async () => {
        const mockSend = jest.fn();
        const mockChannel = {type: 0, send: mockSend};
        const mockClient = {channels: {cache: {get: jest.fn(() => mockChannel)}}};
        jest.unstable_mockModule('@zeffuro/fakegaming-common/dist/managers/configManagerSingleton.js', () => ({
            getConfigManager: () => ({
                twitchManager: {
                    getAllPlain: jest.fn(() => [
                        {twitchUsername: 'streamer1', discordChannelId: '456', customMessage: null},
                        {twitchUsername: 'streamer2', discordChannelId: '456', customMessage: null}
                    ])
                }
            })
        }));
        jest.unstable_mockModule('@twurple/api', () => {
            const getUserByName = jest.fn()
                .mockImplementationOnce(() => Promise.resolve({
                    id: 'id1',
                    displayName: 'Streamer1',
                    name: 'streamer1',
                    profilePictureUrl: 'https://example.com/1.png'
                }))
                .mockImplementationOnce(() => Promise.resolve({
                    id: 'id2',
                    displayName: 'Streamer2',
                    name: 'streamer2',
                    profilePictureUrl: 'https://example.com/2.png'
                }));
            const getStreamByUserId = jest.fn()
                .mockImplementationOnce(() => Promise.resolve({
                    title: 'Live1!',
                    viewers: 100,
                    thumbnailUrl: 'https://example.com/1.png'
                }))
                .mockImplementationOnce(() => Promise.resolve({
                    title: 'Live2!',
                    viewers: 200,
                    thumbnailUrl: 'https://example.com/2.png'
                }));
            return {
                ApiClient: jest.fn(() => ({
                    users: {getUserByName},
                    streams: {getStreamByUserId}
                }))
            };
        });
        const {subscribeAllStreams} = await import('../twitchService.js');
        await subscribeAllStreams(mockClient as unknown as Client);
        expect(mockSend).toHaveBeenCalledTimes(2);
    });
});