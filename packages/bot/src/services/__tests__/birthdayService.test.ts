import {jest} from '@jest/globals';
import type {Client} from 'discord.js';
import {autoMockManager} from '../../test/factories/autoMockManager.js';
import {createMockClient, createMockChannel, createMockSend} from '../../test/mocks/discordMocks.js';

describe('checkAndAnnounceBirthdays', () => {
    it('announces birthdays for today', async () => {
        const mockSend = createMockSend();
        const mockChannel = createMockChannel({send: mockSend});
        const mockClient = createMockClient({channel: mockChannel});

        jest.unstable_mockModule('@zeffuro/fakegaming-common/dist/managers/configManagerSingleton.js', () => ({
            getConfigManager: () => ({
                birthdayManager: autoMockManager.withMethods(['getAllPlain'], {
                    getAllPlain: jest.fn(() => [{
                        userId: '987654321098765432',
                        day: new Date().getDate(),
                        month: new Date().getMonth() + 1,
                        year: 2000,
                        channelId: '4167801562951251571',
                        guildId: 'testguild1'
                    }])
                })
            })
        }));

        const {checkAndAnnounceBirthdays} = await import('../birthdayService.js');
        await checkAndAnnounceBirthdays(mockClient as unknown as Client);
        expect(mockSend).toHaveBeenCalledWith(expect.stringContaining('Happy birthday'));
    });

    it('does nothing if there are no birthdays today', async () => {
        jest.resetModules();
        jest.unstable_mockModule('@zeffuro/fakegaming-common/dist/managers/configManagerSingleton.js', () => ({
            getConfigManager: () => ({
                birthdayManager: autoMockManager.withMethods(['getAllPlain'], {
                    getAllPlain: jest.fn(() => [])
                })
            })
        }));
        const mockSend = createMockSend();
        const mockChannel = createMockChannel({send: mockSend});
        const mockClient = createMockClient({channel: mockChannel});
        const {checkAndAnnounceBirthdays} = await import('../birthdayService.js');
        await checkAndAnnounceBirthdays(mockClient as unknown as Client);
        expect(mockSend).not.toHaveBeenCalled();
    });

    it('handles channel not found', async () => {
        jest.unstable_mockModule('@zeffuro/fakegaming-common/dist/managers/configManagerSingleton.js', () => ({
            getConfigManager: () => ({
                birthdayManager: autoMockManager.withMethods(['getAllPlain'], {
                    getAllPlain: jest.fn(() => [{
                        userId: '987654321098765432',
                        day: new Date().getDate(),
                        month: new Date().getMonth() + 1,
                        year: 2000,
                        channelId: '4167801562951251571',
                        guildId: 'testguild1'
                    }])
                })
            })
        }));
        const mockClient = createMockClient({channel: undefined});
        const {checkAndAnnounceBirthdays} = await import('../birthdayService.js');
        await checkAndAnnounceBirthdays(mockClient as unknown as Client);
        // Should not throw, just not send
    });

    it('handles send failure gracefully', async () => {
        const mockSend = createMockSend();
        mockSend.mockImplementation(() => {
            throw new Error('fail');
        });
        const mockChannel = createMockChannel({send: mockSend});
        const mockClient = createMockClient({channel: mockChannel});
        jest.unstable_mockModule('@zeffuro/fakegaming-common/dist/managers/configManagerSingleton.js', () => ({
            getConfigManager: () => ({
                birthdayManager: autoMockManager.withMethods(['getAllPlain'], {
                    getAllPlain: jest.fn(() => [{
                        userId: '987654321098765432',
                        day: new Date().getDate(),
                        month: new Date().getMonth() + 1,
                        year: 2000,
                        channelId: '4167801562951251571',
                        guildId: 'testguild1'
                    }])
                })
            })
        }));
        const {checkAndAnnounceBirthdays} = await import('../birthdayService.js');
        await expect(checkAndAnnounceBirthdays(mockClient as unknown as Client)).resolves.not.toThrow();
    });

    it('announces multiple birthdays', async () => {
        jest.resetModules();
        const mockSend = createMockSend();
        const mockChannel = createMockChannel({send: mockSend});
        const mockClient = createMockClient({channel: mockChannel});
        jest.unstable_mockModule('@zeffuro/fakegaming-common/dist/managers/configManagerSingleton.js', () => ({
            getConfigManager: () => ({
                birthdayManager: autoMockManager.withMethods(['getAllPlain'], {
                    getAllPlain: jest.fn(() => [
                        {
                            userId: '1',
                            day: new Date().getDate(),
                            month: new Date().getMonth() + 1,
                            year: 2000,
                            channelId: '4167801562951251571',
                            guildId: 'testguild1'
                        },
                        {
                            userId: '2',
                            day: new Date().getDate(),
                            month: new Date().getMonth() + 1,
                            year: 2001,
                            channelId: '4167801562951251571',
                            guildId: 'testguild1'
                        }
                    ])
                })
            })
        }));
        const {checkAndAnnounceBirthdays} = await import('../birthdayService.js');
        await checkAndAnnounceBirthdays(mockClient as unknown as Client);
        expect(mockSend).toHaveBeenCalledTimes(2);
    });

    it('handles birthday with missing channelId gracefully', async () => {
        jest.resetModules();
        jest.unstable_mockModule('@zeffuro/fakegaming-common/dist/managers/configManagerSingleton.js', () => ({
            getConfigManager: () => ({
                birthdayManager: autoMockManager.withMethods(['getAllPlain'], {
                    getAllPlain: jest.fn(() => [{
                        userId: '123',
                        day: new Date().getDate(),
                        month: new Date().getMonth() + 1,
                        year: 2000
                        // channelId missing
                    }])
                })
            })
        }));
        const mockSend = createMockSend();
        const mockChannel = createMockChannel({send: mockSend});
        const mockClient = createMockClient({channel: mockChannel});
        const {checkAndAnnounceBirthdays} = await import('../birthdayService.js');
        await expect(checkAndAnnounceBirthdays(mockClient as unknown as Client)).resolves.not.toThrow();
    });

    it('handles leap year birthday', async () => {
        jest.resetModules();
        jest.unstable_mockModule('@zeffuro/fakegaming-common/dist/managers/configManagerSingleton.js', () => ({
            getConfigManager: () => ({
                birthdayManager: autoMockManager.withMethods(['getAllPlain'], {
                    getAllPlain: jest.fn(() => [{
                        userId: 'leap',
                        day: 29,
                        month: 2,
                        year: 2000,
                        channelId: '4167801562951251571'
                    }])
                })
            })
        }));
        const mockSend = createMockSend();
        const mockChannel = createMockChannel({send: mockSend});
        const mockClient = createMockClient({channel: mockChannel});
        const {checkAndAnnounceBirthdays} = await import('../birthdayService.js');
        // Use Feb 29, 2024 (leap year)
        await checkAndAnnounceBirthdays(mockClient as unknown as Client, new Date('2024-02-29T12:00:00Z'));
        expect(mockSend).toHaveBeenCalledWith(expect.stringContaining('Happy birthday'));
    });

    it('handles error thrown by send gracefully', async () => {
        const mockSend = createMockSend();
        mockSend.mockImplementation(() => {
            throw new Error('fail');
        });
        const mockChannel = createMockChannel({send: mockSend});
        const mockClient = createMockClient({channel: mockChannel});
        jest.unstable_mockModule('@zeffuro/fakegaming-common/dist/managers/configManagerSingleton.js', () => ({
            getConfigManager: () => ({
                birthdayManager: autoMockManager.withMethods(['getAllPlain'], {
                    getAllPlain: jest.fn(() => [{
                        userId: 'err',
                        day: new Date().getDate(),
                        month: new Date().getMonth() + 1,
                        year: 2000,
                        channelId: '4167801562951251571',
                        guildId: 'testguild1'
                    }])
                })
            })
        }));
        const {checkAndAnnounceBirthdays} = await import('../birthdayService.js');
        await expect(checkAndAnnounceBirthdays(mockClient as unknown as Client)).resolves.not.toThrow();
    });
});

let consoleErrorSpy: ReturnType<typeof jest.spyOn>;
beforeEach(() => {
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {
    });
});
afterEach(() => {
    consoleErrorSpy.mockRestore();
    jest.resetModules();
    jest.clearAllMocks();
});
