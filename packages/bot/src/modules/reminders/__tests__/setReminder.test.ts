// filepath: f:\Coding\discord-bot\packages\bot\src\modules\reminders\__tests__\setReminder.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { setupCommandTest } from '@zeffuro/fakegaming-common/testing';
import { ChatInputCommandInteraction, MessageFlags } from 'discord.js';
import { v4 as _uuidv4 } from 'uuid';
import { parseTimespan } from "../../../utils/timeUtils.js";

// Mock the uuid library
vi.mock('uuid', () => ({
    v4: vi.fn().mockReturnValue('mock-uuid-1234')
}));

// Mock the timeUtils module
vi.mock('../../../utils/timeUtils.js', () => ({
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

        // Create mock for reminder manager's add method
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
                    options: {
                        getString: vi.fn().mockImplementation(name => {
                            if (name === 'timespan') return '1h';
                            if (name === 'message') return 'Remember to check the test results';
                            return null;
                        })
                    },
                    user: mockUser
                },
                managerOverrides: {
                    reminderManager: {
                        add: addSpy
                    }
                }
            }
        );

        // Execute the command
        await command.execute(interaction as unknown as ChatInputCommandInteraction);

        // Verify reminder manager's add method was called with the correct parameters
        expect(addSpy).toHaveBeenCalledWith({
            id: 'mock-uuid-1234',
            userId: '123456789012345678',
            message: 'Remember to check the test results',
            timespan: '1h',
            timestamp: 1633030800000 // October 1, 2021 + 1 hour
        });

        // Verify the interaction reply
        expect(interaction.reply).toHaveBeenCalledWith({
            content: expect.stringContaining('⏰ I\'ll remind you in 1h: "Remember to check the test results"'),
            flags: MessageFlags.Ephemeral
        });
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
                    options: {
                        getString: vi.fn().mockImplementation(name => {
                            if (name === 'timespan') return 'invalid';
                            if (name === 'message') return 'Remember to check the test results';
                            return null;
                        })
                    },
                    user: mockUser
                }
            }
        );

        // Execute the command
        await command.execute(interaction as unknown as ChatInputCommandInteraction);

        // Verify the interaction reply for error
        expect(interaction.reply).toHaveBeenCalledWith(
            'Invalid timespan format. Use e.g., 1h, 30m, 2h30m, 90s.'
        );
    });
});
