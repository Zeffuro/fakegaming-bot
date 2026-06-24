import {describe, it, expect, vi, beforeEach} from 'vitest';
import {setupCommandTest, expectEphemeralReply, expectReplyText} from '@zeffuro/fakegaming-common/testing';
import {ChatInputCommandInteraction} from 'discord.js';
import {parseReminderRecurrence, parseTimespan} from '@zeffuro/fakegaming-common/utils';
import {v4 as uuidv4} from 'uuid';

// Mock the uuid library
vi.mock('uuid', () => ({
    v4: vi.fn().mockReturnValue('mock-uuid-1234')
}));

// Mock the shared time utils module
vi.mock('@zeffuro/fakegaming-common/utils', () => ({
    parseReminderRecurrence: vi.fn(),
    parseTimespan: vi.fn()
}));

describe('setReminder command', () => {
    beforeEach(() => {
        // Reset mock call history without tearing down module graph
        vi.restoreAllMocks();
        vi.clearAllMocks();

        // Make Date.now() return a consistent value
        vi.spyOn(Date, 'now').mockReturnValue(1633027200000); // October 1, 2021
        vi.mocked(uuidv4 as unknown as () => string).mockReturnValue('mock-uuid-1234');
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
            timestamp: 1633030800000,
            recurrenceUnit: null,
            recurrenceInterval: null,
            recurrenceTimezone: null,
            lastTriggeredAt: null
        });

        // Verify the interaction reply (ephemeral)
        expectEphemeralReply(interaction, { contains: 'I\'ll remind you in 1h: "Remember to check the test results"' });
    });

    it('sets a recurring reminder with an explicit repeat timezone', async () => {
        vi.mocked(parseTimespan).mockReturnValue(3600000);
        vi.mocked(parseReminderRecurrence).mockReturnValue({unit: 'week', interval: 1, timezone: 'Europe/Amsterdam'});

        const addSpy = vi.fn().mockResolvedValue({
            id: 'mock-uuid-1234',
            userId: '123456789012345678',
            message: 'Water plants',
            timespan: '1h',
            timestamp: 1633030800000,
            recurrenceUnit: 'week',
            recurrenceInterval: 1,
            recurrenceTimezone: 'Europe/Amsterdam'
        });

        const {command, interaction} = await setupCommandTest(
            'modules/reminders/commands/setReminder.js',
            {
                interaction: {
                    stringOptions: {
                        timespan: '1h',
                        message: 'Water plants',
                        repeat: 'weekly',
                        'repeat-timezone': 'Europe/Amsterdam'
                    }
                },
                managerOverrides: {
                    reminderManager: {
                        addReminder: addSpy
                    }
                }
            }
        );

        await command.execute(interaction as unknown as ChatInputCommandInteraction);

        expect(parseReminderRecurrence).toHaveBeenCalledWith('weekly', 'Europe/Amsterdam');
        expect(addSpy).toHaveBeenCalledWith(expect.objectContaining({
            recurrenceUnit: 'week',
            recurrenceInterval: 1,
            recurrenceTimezone: 'Europe/Amsterdam',
            lastTriggeredAt: null
        }));
        expectEphemeralReply(interaction, {contains: 'Repeats every week in Europe/Amsterdam.'});
    });

    it('uses the saved timezone for recurring reminders when no repeat timezone is supplied', async () => {
        vi.mocked(parseTimespan).mockReturnValue(3600000);
        vi.mocked(parseReminderRecurrence).mockReturnValue({unit: 'day', interval: 1, timezone: 'UTC'});

        const addSpy = vi.fn().mockResolvedValue({});
        const getUser = vi.fn().mockResolvedValue({timezone: 'UTC'});
        const {command, interaction} = await setupCommandTest(
            'modules/reminders/commands/setReminder.js',
            {
                interaction: {
                    stringOptions: {timespan: '1h', message: 'Stretch', repeat: 'daily'}
                },
                managerOverrides: {
                    reminderManager: {
                        addReminder: addSpy
                    },
                    userManager: {
                        getUser
                    }
                }
            }
        );

        await command.execute(interaction as unknown as ChatInputCommandInteraction);

        expect(getUser).toHaveBeenCalledWith({discordId: '123456789012345678'});
        expect(parseReminderRecurrence).toHaveBeenCalledWith('daily', 'UTC');
        expect(addSpy).toHaveBeenCalledWith(expect.objectContaining({
            recurrenceUnit: 'day',
            recurrenceTimezone: 'UTC'
        }));
    });

    it('rejects invalid repeat rules', async () => {
        vi.mocked(parseTimespan).mockReturnValue(3600000);
        vi.mocked(parseReminderRecurrence).mockReturnValue(null);

        const addSpy = vi.fn();
        const {command, interaction} = await setupCommandTest(
            'modules/reminders/commands/setReminder.js',
            {
                interaction: {
                    stringOptions: {
                        timespan: '1h',
                        message: 'Stretch',
                        repeat: 'weekdays',
                        'repeat-timezone': 'UTC'
                    }
                },
                managerOverrides: {
                    reminderManager: {
                        addReminder: addSpy
                    }
                }
            }
        );

        await command.execute(interaction as unknown as ChatInputCommandInteraction);

        expect(addSpy).not.toHaveBeenCalled();
        expectEphemeralReply(interaction, {contains: 'Invalid repeat rule.'});
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
