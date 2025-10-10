import { describe, it, expect, beforeEach, vi } from 'vitest';
import { setupServiceTest, createMockUser, createMockReminder } from '@zeffuro/fakegaming-common/testing';
import { User } from 'discord.js';
import { getConfigManager } from '@zeffuro/fakegaming-common/managers';

vi.mock('@zeffuro/fakegaming-common/utils', () => ({
    formatElapsed: vi.fn((_ms: number) => '2 hours ago'),
    parseTimespan: vi.fn((_timespan: string) => 7200000), // 2 hours in ms
}));

import { checkAndSendReminders } from '../reminderService.js';

describe('reminderService', () => {
    let client: Awaited<ReturnType<typeof setupServiceTest>>['client'];
    let configManager: ReturnType<typeof getConfigManager>;

    beforeEach(async () => {
        const setup = await setupServiceTest();
        client = setup.client;
        configManager = setup.configManager;

        vi.clearAllMocks();
    });

    it('should send due reminders to users', async () => {
        const now = Date.now();
        const mockUser = createMockUser({ id: 'user-123', toString: () => '<@user-123>' as `<@${string}>`, valueOf: () => 'user-123' } as Partial<User>);
        const dueReminder = createMockReminder({
            id: 'reminder-1',
            userId: 'user-123',
            message: 'Test reminder message',
            timestamp: now - 1000, // Past due
            timespan: '2h',
        });

        vi.spyOn(client.users, 'fetch').mockResolvedValue(mockUser as any);
        vi.spyOn(configManager.reminderManager, 'getAllPlain').mockResolvedValue([dueReminder] as any);
        vi.spyOn(configManager.reminderManager, 'removeReminder').mockResolvedValue(undefined as any);

        await checkAndSendReminders(client);

        expect(client.users.fetch).toHaveBeenCalledWith('user-123');
        expect(mockUser.send).toHaveBeenCalledWith({
            embeds: [expect.objectContaining({
                data: expect.objectContaining({
                    title: '⏰ Reminder',
                    description: 'Test reminder message',
                }),
            })],
        });
        expect(configManager.reminderManager.removeReminder).toHaveBeenCalledWith('reminder-1');
    });

    it('should not send reminders that are not yet due', async () => {
        const now = Date.now();
        const futureReminder = createMockReminder({
            id: 'reminder-2',
            userId: 'user-456',
            timestamp: now + 10000, // Future
        });

        vi.spyOn(configManager.reminderManager, 'getAllPlain').mockResolvedValue([futureReminder] as any);
        vi.spyOn(client.users, 'fetch').mockResolvedValue(createMockUser() as any);

        await checkAndSendReminders(client);

        expect(client.users.fetch).not.toHaveBeenCalled();
    });

    it('should handle missing users gracefully', async () => {
        const now = Date.now();
        const dueReminder = createMockReminder({
            id: 'reminder-3',
            userId: 'missing-user',
            timestamp: now - 1000,
        });

        vi.spyOn(configManager.reminderManager, 'getAllPlain').mockResolvedValue([dueReminder] as any);
        vi.spyOn(client.users, 'fetch').mockResolvedValue(null as any);
        vi.spyOn(console, 'warn').mockImplementation(() => {});

        await checkAndSendReminders(client);

        expect(console.warn).toHaveBeenCalledWith(
            expect.stringContaining('User missing-user not found')
        );
    });

    it('should continue processing after send failure', async () => {
        const now = Date.now();
        const mockUser1 = createMockUser({ id: 'user-1', toString: () => '<@user-1>' as `<@${string}>`, valueOf: () => 'user-1' } as Partial<User>);
        const mockUser2 = createMockUser({ id: 'user-2', toString: () => '<@user-2>' as `<@${string}>`, valueOf: () => 'user-2' } as Partial<User>);

        vi.mocked(mockUser1.send).mockRejectedValue(new Error('DM blocked'));

        const reminders = [
            createMockReminder({ id: 'r1', userId: 'user-1', timestamp: now - 1000 }),
            createMockReminder({ id: 'r2', userId: 'user-2', timestamp: now - 1000 }),
        ];

        vi.spyOn(configManager.reminderManager, 'getAllPlain').mockResolvedValue(reminders as any);
        vi.spyOn(client.users, 'fetch')
            .mockResolvedValueOnce(mockUser1 as any)
            .mockResolvedValueOnce(mockUser2 as any);
        vi.spyOn(configManager.reminderManager, 'removeReminder').mockResolvedValue(undefined as any);
        vi.spyOn(console, 'error').mockImplementation(() => {});

        await checkAndSendReminders(client);

        expect(mockUser2.send).toHaveBeenCalled();
        expect(configManager.reminderManager.removeReminder).toHaveBeenCalledWith('r1');
        expect(configManager.reminderManager.removeReminder).toHaveBeenCalledWith('r2');
    });
});
