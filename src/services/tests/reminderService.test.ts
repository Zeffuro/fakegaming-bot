import {jest} from '@jest/globals';

describe('checkAndSendReminders', () => {
    it('sends due reminders and removes them', async () => {
        const mockSend = jest.fn();
        const mockUser = {send: mockSend};
        const mockClient = {
            users: {fetch: jest.fn(() => Promise.resolve(mockUser))}
        };
        jest.unstable_mockModule('../../config/configManagerSingleton.js', () => ({
            configManager: {
                reminderManager: {
                    getAll: jest.fn(() => [{
                        id: 'd623bf17-540f-442c-b042-4b136f15772d',
                        userId: '987654321098765432',
                        timestamp: Date.now() - 1000,
                        message: 'Test reminder',
                        timespan: '1m'
                    }]),
                    removeReminder: jest.fn()
                }
            }
        }));
        jest.unstable_mockModule('../../utils/timeUtils.js', () => ({
            formatElapsed: jest.fn(() => '1 minute ago'),
            parseTimespan: jest.fn(() => 60000)
        }));
        const {checkAndSendReminders} = await import('../reminderService.js');
        await checkAndSendReminders(mockClient as any);
        expect(mockSend).toHaveBeenCalled();
    });
});