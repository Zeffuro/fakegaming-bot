import {describe, it, expect, vi} from 'vitest';
import {AutocompleteInteraction, ChatInputCommandInteraction} from 'discord.js';
import {createMockAutocompleteInteraction, setupCommandTest, expectEphemeralReply, expectReplyTextContains} from '@zeffuro/fakegaming-common/testing';

const now = Date.now();
const reminders = [
    {id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', userId: '123456789012345678', message: 'First', timestamp: now + 60_000, timespan: '1m'},
    {id: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', userId: '123456789012345678', message: 'Second', timestamp: now + 120_000, timespan: '2m'},
];
const activeRecurringReminder = {
    id: 'cccccccc-cccc-cccc-cccc-cccccccccccc',
    userId: '123456789012345678',
    message: 'Drink water',
    timestamp: now + 180_000,
    timespan: '3m',
    completed: false,
    recurrenceUnit: 'day',
    recurrenceInterval: 1,
    recurrenceTimezone: 'UTC',
};
const pausedRecurringReminder = {
    id: 'dddddddd-dddd-dddd-dddd-dddddddddddd',
    userId: '123456789012345678',
    message: 'Standup prep',
    timestamp: now + 240_000,
    timespan: '4m',
    completed: true,
    recurrenceUnit: 'week',
    recurrenceInterval: 1,
    recurrenceTimezone: 'UTC',
};

describe('reminder management commands', () => {
    it('lists active and paused reminders', async () => {
        const {command, interaction} = await setupCommandTest(
            'modules/reminders/commands/reminders.js',
            {
                managerOverrides: {
                    reminderManager: {getRemindersByUser: vi.fn().mockResolvedValue([...reminders, pausedRecurringReminder])},
                },
            }
        );

        await command.execute(interaction as unknown as ChatInputCommandInteraction);

        expectReplyTextContains(interaction, 'Your reminders:');
        expectReplyTextContains(interaction, '`aaaaaaaa`');
        expectReplyTextContains(interaction, 'First');
        expectReplyTextContains(interaction, '`dddddddd`');
        expectReplyTextContains(interaction, '[paused]');
        expectReplyTextContains(interaction, 'every week');
    });

    it('deletes by list number', async () => {
        const removeReminder = vi.fn().mockResolvedValue(undefined);
        const {command, interaction} = await setupCommandTest(
            'modules/reminders/commands/deleteReminder.js',
            {
                interaction: {stringOptions: {reminder: '2'}},
                managerOverrides: {
                    reminderManager: {
                        getRemindersByUser: vi.fn().mockResolvedValue(reminders),
                        removeReminder,
                    },
                },
            }
        );

        await command.execute(interaction as unknown as ChatInputCommandInteraction);

        expect(removeReminder).toHaveBeenCalledWith('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb');
        expectReplyTextContains(interaction, 'Deleted reminder `bbbbbbbb`');
    });

    it('autocompletes pending reminder IDs for delete', async () => {
        const dateNow = vi.spyOn(Date, 'now').mockReturnValue(now);
        const {command} = await setupCommandTest(
            'modules/reminders/commands/deleteReminder.js',
            {
                managerOverrides: {
                    reminderManager: {
                        getRemindersByUser: vi.fn().mockResolvedValue([...reminders, pausedRecurringReminder]),
                    },
                },
            }
        );
        const interaction = createMockAutocompleteInteraction({focused: 'sec'});

        await command.autocomplete(interaction as AutocompleteInteraction);
        dateNow.mockRestore();

        expect(interaction.respond).toHaveBeenCalledWith([
            expect.objectContaining({
                name: expect.stringContaining('Second'),
                value: 'bbbbbbbb',
            }),
        ]);
    });

    it('snoozes by short id', async () => {
        const updatePlain = vi.fn().mockResolvedValue([1, []]);
        const {command, interaction} = await setupCommandTest(
            'modules/reminders/commands/snoozeReminder.js',
            {
                interaction: {stringOptions: {reminder: 'aaaaaaaa', timespan: '10m'}},
                managerOverrides: {
                    reminderManager: {
                        getRemindersByUser: vi.fn().mockResolvedValue(reminders),
                        updatePlain,
                    },
                },
            }
        );

        await command.execute(interaction as unknown as ChatInputCommandInteraction);

        expect(updatePlain).toHaveBeenCalled();
        expectReplyTextContains(interaction, 'Snoozed reminder `aaaaaaaa`');
    });

    it('autocompletes pending reminder IDs for snooze', async () => {
        const dateNow = vi.spyOn(Date, 'now').mockReturnValue(now);
        const {command} = await setupCommandTest(
            'modules/reminders/commands/snoozeReminder.js',
            {
                managerOverrides: {
                    reminderManager: {
                        getRemindersByUser: vi.fn().mockResolvedValue([...reminders, activeRecurringReminder, pausedRecurringReminder]),
                    },
                },
            }
        );
        const interaction = createMockAutocompleteInteraction({focused: 'drink'});

        await command.autocomplete(interaction as AutocompleteInteraction);
        dateNow.mockRestore();

        expect(interaction.respond).toHaveBeenCalledWith([
            expect.objectContaining({
                name: expect.stringContaining('[recurring]'),
                value: 'cccccccc',
            }),
        ]);
    });

    it('pauses a recurring reminder by short id', async () => {
        const setPausedForUser = vi.fn().mockResolvedValue({...activeRecurringReminder, completed: true});
        const {command, interaction} = await setupCommandTest(
            'modules/reminders/commands/pauseReminder.js',
            {
                interaction: {stringOptions: {reminder: 'cccccccc'}},
                managerOverrides: {
                    reminderManager: {
                        getRemindersByUser: vi.fn().mockResolvedValue([...reminders, activeRecurringReminder]),
                        setPausedForUser,
                    },
                },
            }
        );

        await command.execute(interaction as unknown as ChatInputCommandInteraction);

        expect(setPausedForUser).toHaveBeenCalledWith(
            'cccccccc-cccc-cccc-cccc-cccccccccccc',
            '123456789012345678',
            {paused: true}
        );
        expectEphemeralReply(interaction, {contains: 'Paused recurring reminder `cccccccc`'});
    });

    it('autocompletes active recurring reminder IDs for pause', async () => {
        const dateNow = vi.spyOn(Date, 'now').mockReturnValue(now);
        const {command} = await setupCommandTest(
            'modules/reminders/commands/pauseReminder.js',
            {
                managerOverrides: {
                    reminderManager: {
                        getRemindersByUser: vi.fn().mockResolvedValue([...reminders, activeRecurringReminder, pausedRecurringReminder]),
                    },
                },
            }
        );
        const interaction = createMockAutocompleteInteraction();

        await command.autocomplete(interaction as AutocompleteInteraction);
        dateNow.mockRestore();

        expect(interaction.respond).toHaveBeenCalledWith([
            expect.objectContaining({
                name: expect.stringContaining('[recurring]'),
                value: 'cccccccc',
            }),
        ]);
    });

    it('resumes a stale recurring reminder and advances the next run', async () => {
        const stalePausedReminder = {
            ...pausedRecurringReminder,
            timestamp: now - 60_000,
        };
        const setPausedForUser = vi.fn().mockResolvedValue({...stalePausedReminder, completed: false});
        const dateNow = vi.spyOn(Date, 'now').mockReturnValue(now);
        const {command, interaction} = await setupCommandTest(
            'modules/reminders/commands/resumeReminder.js',
            {
                interaction: {stringOptions: {reminder: 'dddddddd'}},
                managerOverrides: {
                    reminderManager: {
                        getRemindersByUser: vi.fn().mockResolvedValue([stalePausedReminder]),
                        setPausedForUser,
                    },
                },
            }
        );

        await command.execute(interaction as unknown as ChatInputCommandInteraction);
        dateNow.mockRestore();

        expect(setPausedForUser).toHaveBeenCalledWith(
            'dddddddd-dddd-dddd-dddd-dddddddddddd',
            '123456789012345678',
            expect.objectContaining({paused: false, timestamp: expect.any(Number)})
        );
        const update = setPausedForUser.mock.calls[0]?.[2] as {timestamp?: number};
        expect(update.timestamp).toBeGreaterThan(now);
        expectEphemeralReply(interaction, {contains: 'Resumed recurring reminder `dddddddd`'});
    });

    it('autocompletes paused recurring reminder IDs for resume', async () => {
        const dateNow = vi.spyOn(Date, 'now').mockReturnValue(now);
        const {command} = await setupCommandTest(
            'modules/reminders/commands/resumeReminder.js',
            {
                managerOverrides: {
                    reminderManager: {
                        getRemindersByUser: vi.fn().mockResolvedValue([...reminders, activeRecurringReminder, pausedRecurringReminder]),
                    },
                },
            }
        );
        const interaction = createMockAutocompleteInteraction();

        await command.autocomplete(interaction as AutocompleteInteraction);
        dateNow.mockRestore();

        expect(interaction.respond).toHaveBeenCalledWith([
            expect.objectContaining({
                name: expect.stringContaining('[paused]'),
                value: 'dddddddd',
            }),
        ]);
    });

    it('rejects pausing one-off reminders', async () => {
        const setPausedForUser = vi.fn();
        const {command, interaction} = await setupCommandTest(
            'modules/reminders/commands/pauseReminder.js',
            {
                interaction: {stringOptions: {reminder: 'aaaaaaaa'}},
                managerOverrides: {
                    reminderManager: {
                        getRemindersByUser: vi.fn().mockResolvedValue(reminders),
                        setPausedForUser,
                    },
                },
            }
        );

        await command.execute(interaction as unknown as ChatInputCommandInteraction);

        expect(setPausedForUser).not.toHaveBeenCalled();
        expectEphemeralReply(interaction, {contains: 'Only recurring reminders can be paused.'});
    });
});
