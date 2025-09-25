import {jest} from '@jest/globals';
import {Client} from "discord.js";
import {autoMockManager} from '../../test/factories/autoMockManager.js';
import {createMockClient, createMockUser, createMockSend} from '../../test/mocks/discordMocks.js';

const mockSend = createMockSend();
const mockUser = createMockUser({send: mockSend});
const mockClient = createMockClient({user: mockUser});

const mockReminderManager = autoMockManager.withMethods(['getAllPlain', 'removeReminder']);

jest.unstable_mockModule('@zeffuro/fakegaming-common/dist/managers/configManagerSingleton.js', () => ({
    getConfigManager: () => ({
        reminderManager: mockReminderManager
    })
}));

jest.unstable_mockModule('../../utils/timeUtils.js', () => ({
    formatElapsed: jest.fn(() => '1 minute ago'),
    parseTimespan: jest.fn(() => 60000)
}));

describe('checkAndSendReminders', () => {
    let consoleErrorSpy: ReturnType<typeof jest.spyOn>;

    beforeEach(() => {
        jest.clearAllMocks();
        mockReminderManager.getAllPlain.mockReset();
        mockReminderManager.removeReminder.mockReset();
        mockSend.mockReset();
        consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {
        });
    });
    afterEach(() => {
        consoleErrorSpy.mockRestore();
        jest.resetModules();
        jest.clearAllMocks();
    });

    it('sends due reminders and removes them', async () => {
        mockReminderManager.getAllPlain.mockReturnValue([
            {
                userId: '1',
                message: 'msg',
                id: 'r1',
                channelId: 'c1',
                createdAt: new Date(),
                remindAt: new Date(),
                timestamp: Date.now() - 1000
            }
        ]);
        const {checkAndSendReminders} = await import('../reminderService.js');
        await checkAndSendReminders(mockClient as unknown as Client);
        expect(mockSend).toHaveBeenCalled();
        expect(mockReminderManager.removeReminder).toHaveBeenCalled();
    });

    it('does nothing if there are no reminders', async () => {
        mockReminderManager.getAllPlain.mockReturnValue([]);
        const {checkAndSendReminders} = await import('../reminderService.js');
        await checkAndSendReminders(mockClient as unknown as Client);
        expect(mockSend).not.toHaveBeenCalled();
    });

    it('handles user not found', async () => {
        const client = createMockClient({user: undefined});
        mockReminderManager.getAllPlain.mockReturnValue([
            {
                userId: '1',
                message: 'msg',
                id: 'r1',
                channelId: 'c1',
                createdAt: new Date(),
                remindAt: new Date(),
                timestamp: Date.now() - 1000
            }
        ]);
        const {checkAndSendReminders} = await import('../reminderService.js');
        await checkAndSendReminders(client as unknown as Client);
        // Should not throw, just not send
        expect(mockSend).not.toHaveBeenCalled();
    });

    it('handles send failure gracefully', async () => {
        mockSend.mockImplementation(() => {
            throw new Error('fail');
        });
        mockReminderManager.getAllPlain.mockReturnValue([
            {
                userId: '1',
                message: 'msg',
                id: 'r1',
                channelId: 'c1',
                createdAt: new Date(),
                remindAt: new Date(),
                timestamp: Date.now() - 1000
            }
        ]);
        const {checkAndSendReminders} = await import('../reminderService.js');
        await expect(checkAndSendReminders(mockClient as unknown as Client)).resolves.not.toThrow();
    });

    it('processes multiple reminders', async () => {
        mockReminderManager.getAllPlain.mockReturnValue([
            {
                userId: '1',
                message: 'msg1',
                id: 'r1',
                channelId: 'c1',
                createdAt: new Date(),
                remindAt: new Date(),
                timestamp: Date.now() - 1000
            },
            {
                userId: '2',
                message: 'msg2',
                id: 'r2',
                channelId: 'c2',
                createdAt: new Date(),
                remindAt: new Date(),
                timestamp: Date.now() - 1000
            }
        ]);
        const {checkAndSendReminders} = await import('../reminderService.js');
        await checkAndSendReminders(mockClient as unknown as Client);
        expect(mockSend).toHaveBeenCalled();
        expect(mockReminderManager.removeReminder).toHaveBeenCalledTimes(2);
    });

    it('does not send reminders scheduled in the future', async () => {
        mockReminderManager.getAllPlain.mockReturnValue([
            {
                userId: '1',
                message: 'future',
                id: 'r1',
                channelId: 'c1',
                createdAt: new Date(),
                remindAt: new Date(),
                timestamp: Date.now() + 100000 // future
            }
        ]);
        const {checkAndSendReminders} = await import('../reminderService.js');
        await checkAndSendReminders(mockClient as unknown as Client);
        expect(mockSend).not.toHaveBeenCalled();
        expect(mockReminderManager.removeReminder).not.toHaveBeenCalled();
    });

    it('handles reminders with missing fields gracefully', async () => {
        mockReminderManager.getAllPlain.mockReturnValue([
            {
                // missing userId, message, etc.
                id: 'r1',
                channelId: 'c1',
                createdAt: new Date(),
                remindAt: new Date(),
                timestamp: Date.now() - 1000
            }
        ]);
        const {checkAndSendReminders} = await import('../reminderService.js');
        await expect(checkAndSendReminders(mockClient as unknown as Client)).resolves.not.toThrow();
    });

    it('handles error thrown by removeReminder', async () => {
        mockReminderManager.getAllPlain.mockReturnValue([
            {
                userId: '1',
                message: 'msg',
                id: 'r1',
                channelId: 'c1',
                createdAt: new Date(),
                remindAt: new Date(),
                timestamp: Date.now() - 1000
            }
        ]);
        mockReminderManager.removeReminder.mockImplementation(() => {
            throw new Error('fail');
        });
        const {checkAndSendReminders} = await import('../reminderService.js');
        await expect(checkAndSendReminders(mockClient as unknown as Client)).resolves.not.toThrow();
    });
});