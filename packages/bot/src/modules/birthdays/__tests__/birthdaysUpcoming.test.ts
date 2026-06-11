import {describe, it, vi} from 'vitest';
import {ChatInputCommandInteraction} from 'discord.js';
import {setupCommandTest, expectReplyTextContains} from '@zeffuro/fakegaming-common/testing';

describe('birthdays upcoming command', () => {
    it('shows upcoming birthdays for the current guild', async () => {
        const now = new Date();
        const birthday = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 4);
        const {command, interaction} = await setupCommandTest(
            'modules/birthdays/commands/birthdays.js',
            {
                interaction: {
                    subcommand: 'upcoming',
                    integerOptions: {days: 10},
                    guildId: 'guild-1',
                },
                managerOverrides: {
                    birthdayManager: {
                        getAllPlain: vi.fn().mockResolvedValue([
                            {userId: 'user-1', guildId: 'guild-1', day: birthday.getDate(), month: birthday.getMonth() + 1, year: 2000, channelId: 'chan'},
                            {userId: 'user-2', guildId: 'guild-2', day: birthday.getDate(), month: birthday.getMonth() + 1, channelId: 'chan'},
                        ]),
                    },
                },
            }
        );

        await command.execute(interaction as unknown as ChatInputCommandInteraction);

        expectReplyTextContains(interaction, 'Upcoming birthdays in the next 10 days:');
        expectReplyTextContains(interaction, '<@user-1>');
        expectReplyTextContains(interaction, 'turns');
    });
});
