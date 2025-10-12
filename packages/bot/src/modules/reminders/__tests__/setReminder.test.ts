import { describe, it, expect, vi, beforeEach } from 'vitest';
import { setupCommandTest, expectEphemeralReply, expectReplyText } from '@zeffuro/fakegaming-common/testing';
import { ChatInputCommandInteraction } from 'discord.js';
import { v4 as _uuidv4 } from 'uuid';
import { parseTimespan } from '@zeffuro/fakegaming-common/utils';

// Mock the uuid library
vi.mock('uuid', () => ({
    v4: vi.fn().mockReturnValue('mock-uuid-1234')
}));

// Mock the shared time utils module
vi.mock('@zeffuro/fakegaming-common/utils', () => ({
    parseTimespan: vi.fn()
}));

describe('setReminder command', () => {
    beforeEach(() => {
        // Reset all mocks and clear module cache before each test
        vi.resetAllMocks();
        vi.resetModules();

        // Make Date.now() return a consistent value
        vi.spyOn(Date, 'now').mockReturnValue(1633027200000); // October 1, 2021
    });

    it('sets a reminder with a valid timespan', async () => {
        // Setup parseTimespan to return a valid number for this test
        vi.mocked(parseTimespan).mockReturnValue(3600000); // 1 hour in ms

        // Create mock for reminder manager's addReminder method
        const addSpy = vi.fn().mockResolvedValue({
            id: 'mock-uuid-1234',
            userId: '123456789012345678',
            message: 'Remember to check the test results',
            timespan: '1h',
            timestamp: 1633030800000 // October 1, 2021 + 1 hour
        });

        // Mock user
        const mockUser = {
            id: '123456789012345678',
            tag: 'testUser#1234'
        };

        // Setup the test environment
        const { command, interaction } = await setupCommandTest(
            'modules/reminders/commands/setReminder.js',
            {
                interaction: {
                    stringOptions: { timespan: '1h', message: 'Remember to check the test results' },
                    user: mockUser
                },
                managerOverrides: {
                    reminderManager: {
                        addReminder: addSpy
                    }
                }
            }
        );

        // Execute the command
        await command.execute(interaction as unknown as ChatInputCommandInteraction);

        // Verify reminder manager's addReminder method was called with the correct parameters
        expect(addSpy).toHaveBeenCalledWith({
            id: 'mock-uuid-1234',
            userId: '123456789012345678',
            message: 'Remember to check the test results',
            timespan: '1h',
            timestamp: 1633030800000
        });

        // Verify the interaction reply (ephemeral)
        expectEphemeralReply(interaction, { contains: '⏰ I\'ll remind you in 1h: "Remember to check the test results"' });
    });

    it('handles invalid timespan format', async () => {
        // Setup parseTimespan to return null for this test to simulate invalid input
        vi.mocked(parseTimespan).mockReturnValue(null);

        // Mock user
        const mockUser = {
            id: '123456789012345678',
            tag: 'testUser#1234'
        };

        // Setup the test environment
        const { command, interaction } = await setupCommandTest(
            'modules/reminders/commands/setReminder.js',
            {
                interaction: {
                    stringOptions: { timespan: 'invalid', message: 'Remember to check the test results' },
                    user: mockUser
                }
            }
        );

        // Execute the command
        await command.execute(interaction as unknown as ChatInputCommandInteraction);

        // Verify the interaction reply for error
        expectReplyText(
            interaction,
            'Invalid timespan format. Use e.g., 1h, 30m, 2h30m, 90s.'
        );
    });
});
