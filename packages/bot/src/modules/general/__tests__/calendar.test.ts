import {describe, it, vi} from 'vitest';
import {ChatInputCommandInteraction} from 'discord.js';
import {expectEphemeralReply, setupCommandTest} from '@zeffuro/fakegaming-common/testing';

describe('calendar command', () => {
    it('shows upcoming birthdays and the requester reminders', async () => {
        const now = new Date();
        const birthdayDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 3);
        const reminderTimestamp = Date.now() + 2 * 24 * 60 * 60 * 1000;
        const {command, interaction} = await setupCommandTest(
            'modules/general/commands/calendar.js',
            {
                interaction: {
                    integerOptions: {days: 7},
                    guildId: 'guild-1',
                    user: {id: 'user-1', tag: 'user#0001'},
                },
                managerOverrides: {
                    birthdayManager: {
                        getAllPlain: vi.fn().mockResolvedValue([
                            {
                                userId: 'birthday-user',
                                guildId: 'guild-1',
                                day: birthdayDate.getDate(),
                                month: birthdayDate.getMonth() + 1,
                                channelId: 'channel-1',
                            },
                            {
                                userId: 'other-guild-user',
                                guildId: 'guild-2',
                                day: birthdayDate.getDate(),
                                month: birthdayDate.getMonth() + 1,
                                channelId: 'channel-2',
                            },
                        ]),
                    },
                    reminderManager: {
                        getRemindersByUser: vi.fn().mockResolvedValue([
                            {
                                id: 'reminder-one',
                                message: 'Check the deploy',
                                timestamp: reminderTimestamp,
                            },
                        ]),
                    },
                },
            }
        );

        await command.execute(interaction as unknown as ChatInputCommandInteraction);

        expectEphemeralReply(interaction, {contains: 'Upcoming calendar for the next 7 days'});
        expectEphemeralReply(interaction, {contains: '<@birthday-user>'});
        expectEphemeralReply(interaction, {contains: 'Your Reminders'});
        expectEphemeralReply(interaction, {contains: 'Check the deploy'});
    });
});
