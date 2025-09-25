import {jest} from '@jest/globals';
import {Client} from "discord.js";

const mockSend = jest.fn();
const mockUser = {send: mockSend};
const mockClient = {
    users: {fetch: jest.fn(() => Promise.resolve(mockUser))}
};

const mockReminderManager = {
    getAllPlain: jest.fn(() => [{
        id: 'd623bf17-540f-442c-b042-4b136f15772d',
        userId: '987654321098765432',
        timestamp: Date.now() - 1000,
        message: 'Test reminder',
        timespan: '1m'
    }]),
    removeReminder: jest.fn()
};

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
    it('sends due reminders and removes them', async () => {
        const {checkAndSendReminders} = await import('../reminderService.js');
        await checkAndSendReminders(mockClient as unknown as Client);
        expect(mockSend).toHaveBeenCalled();
        expect(mockReminderManager.removeReminder).toHaveBeenCalled();
    });
});