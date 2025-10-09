import { describe, it, expect, beforeEach, vi } from 'vitest';
import { setupServiceTest, createMockBirthday, createMockTextChannel } from '@zeffuro/fakegaming-common/testing';
import { TextChannel } from 'discord.js';
import { getConfigManager } from '@zeffuro/fakegaming-common/managers';
import { checkAndAnnounceBirthdays } from '../birthdayService.js';

describe('birthdayService', () => {
    let client: Awaited<ReturnType<typeof setupServiceTest>>['client'];
    let configManager: ReturnType<typeof getConfigManager>;

    beforeEach(async () => {
        const setup = await setupServiceTest();
        client = setup.client;
        configManager = setup.configManager;
    });

    it('should announce birthdays for users today', async () => {
        const testDate = new Date('2025-10-06');
        const birthday = createMockBirthday({
            userId: 'user-123',
            channelId: 'channel-123',
            day: 6,
            month: 10,
            year: 2000,
        });

        const mockChannel = createMockTextChannel({
            id: 'channel-123',
            toString: () => '<#channel-123>' as `<#${string}>`,
            valueOf: () => 'channel-123',
            isTextBased: () => true,
        } as Partial<TextChannel>);

        vi.spyOn(configManager.birthdayManager, 'getAllPlain').mockResolvedValue([birthday]);
        vi.spyOn(configManager.birthdayManager, 'isBirthdayToday').mockReturnValue(true);
        vi.spyOn(client.channels, 'fetch').mockResolvedValue(mockChannel as any);

        await checkAndAnnounceBirthdays(client, testDate);

        expect(client.channels.fetch).toHaveBeenCalledWith('channel-123');
        expect(mockChannel.send).toHaveBeenCalledWith(
            expect.stringContaining('Happy birthday <@user-123> (turning 25)!')
        );
    });

    it('should skip birthdays not today', async () => {
        const testDate = new Date('2025-10-07');
        const birthday = createMockBirthday({ day: 6, month: 10 });

        vi.spyOn(configManager.birthdayManager, 'getAllPlain').mockResolvedValue([birthday]);
        vi.spyOn(configManager.birthdayManager, 'isBirthdayToday').mockReturnValue(false);

        await checkAndAnnounceBirthdays(client, testDate);

        expect(client.channels.fetch).not.toHaveBeenCalled();
    });
});
