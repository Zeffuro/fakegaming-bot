import {afterEach, describe, expect, it, vi} from 'vitest';
import {MessageContextMenuCommandInteraction, type Message} from 'discord.js';
import {
    createMockMessage,
    expectEphemeralReply,
    setupCommandTest,
} from '@zeffuro/fakegaming-common/testing';

describe('Remind Me in 1h context command', () => {
    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('creates a one-hour reminder for the target message', async () => {
        vi.spyOn(Date, 'now').mockReturnValue(1700000000000);
        const addReminder = vi.fn().mockResolvedValue({});
        const targetMessage = createMockMessage({
            id: 'message-1',
            channelId: 'channel-1',
            url: 'https://discord.com/channels/guild-1/channel-1/message-1',
        } as Partial<Message>);
        const {command, interaction} = await setupCommandTest(
            'modules/reminders/commands/remindMeInOneHour.js',
            {
                interaction: {
                    guildId: 'guild-1',
                    user: {id: 'reminder-user'},
                    targetMessage,
                },
                managerOverrides: {
                    reminderManager: {
                        addReminder,
                    },
                },
            }
        );

        await command.execute(interaction as unknown as MessageContextMenuCommandInteraction);

        expect(addReminder).toHaveBeenCalledWith(expect.objectContaining({
            userId: 'reminder-user',
            message: 'Follow up on this message: https://discord.com/channels/guild-1/channel-1/message-1',
            timespan: '1h',
            timestamp: 1700003600000,
        }));
        expectEphemeralReply(interaction, {contains: 'Reminder set for'});
    });
});
