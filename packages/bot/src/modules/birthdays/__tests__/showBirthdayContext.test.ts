import {describe, expect, it, vi} from 'vitest';
import {UserContextMenuCommandInteraction, type User} from 'discord.js';
import {createMockUser, expectEphemeralReply, setupCommandTest} from '@zeffuro/fakegaming-common/testing';

describe('Show Birthday context command', () => {
    it('shows the target user birthday for the current guild', async () => {
        const getBirthday = vi.fn().mockResolvedValue({day: 7, month: 4, year: 1994});
        const targetUser = createMockUser({id: 'target-user'} as Partial<User>);
        const {command, interaction} = await setupCommandTest(
            'modules/birthdays/commands/showBirthday.js',
            {
                interaction: {
                    guildId: 'guild-1',
                    targetUser,
                },
                managerOverrides: {
                    birthdayManager: {
                        getBirthday,
                    },
                },
            }
        );

        await command.execute(interaction as unknown as UserContextMenuCommandInteraction);

        expect(getBirthday).toHaveBeenCalledWith('target-user', 'guild-1');
        expectEphemeralReply(interaction, {contains: "testuser#0001's birthday: 7 April 1994"});
    });

    it('handles missing birthdays', async () => {
        const targetUser = createMockUser({id: 'target-user'} as Partial<User>);
        const {command, interaction} = await setupCommandTest(
            'modules/birthdays/commands/showBirthday.js',
            {
                interaction: {
                    guildId: 'guild-1',
                    targetUser,
                },
                managerOverrides: {
                    birthdayManager: {
                        getBirthday: vi.fn().mockResolvedValue(null),
                    },
                },
            }
        );

        await command.execute(interaction as unknown as UserContextMenuCommandInteraction);

        expectEphemeralReply(interaction, {contains: 'does not have a birthday set'});
    });
});
