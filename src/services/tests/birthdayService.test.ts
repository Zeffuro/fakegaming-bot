import {jest} from '@jest/globals';

describe('checkAndAnnounceBirthdays', () => {
    it('announces birthdays for today', async () => {
        const mockSend = jest.fn();
        const mockChannel = {isTextBased: () => true, send: mockSend};
        const mockClient = {
            channels: {fetch: jest.fn(() => Promise.resolve(mockChannel))}
        };
        // Mock configManager before importing the service
        jest.unstable_mockModule('../../config/configManagerSingleton.js', () => ({
            configManager: {
                birthdayManager: {
                    getAll: jest.fn(() => [{
                        userId: '987654321098765432',
                        day: new Date().getDate(),
                        month: new Date().getMonth() + 1,
                        year: 2000,
                        channelId: '4167801562951251571'
                    }])
                }
            }
        }));
        const {checkAndAnnounceBirthdays} = await import('../birthdayService.js');
        await checkAndAnnounceBirthdays(mockClient as any);
        expect(mockSend).toHaveBeenCalledWith(expect.stringContaining('Happy birthday'));
    });
});