import {describe, it, expect, vi} from 'vitest';
import {ChatInputCommandInteraction} from 'discord.js';
import {setupCommandTest, expectReplyTextContains} from '@zeffuro/fakegaming-common/testing';

const now = Date.now();
const reminders = [
    {id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', userId: '123456789012345678', message: 'First', timestamp: now + 60_000, timespan: '1m'},
    {id: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', userId: '123456789012345678', message: 'Second', timestamp: now + 120_000, timespan: '2m'},
];

describe('reminder management commands', () => {
    it('lists pending reminders', async () => {
        const {command, interaction} = await setupCommandTest(
            'modules/reminders/commands/reminders.js',
            {
                managerOverrides: {
                    reminderManager: {getRemindersByUser: vi.fn().mockResolvedValue(reminders)},
                },
            }
        );

        await command.execute(interaction as unknown as ChatInputCommandInteraction);

        expectReplyTextContains(interaction, 'Your pending reminders:');
        expectReplyTextContains(interaction, '`aaaaaaaa`');
        expectReplyTextContains(interaction, 'First');
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
});
