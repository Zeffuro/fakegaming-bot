import {describe, it, expect, vi} from 'vitest';
import {ChatInputCommandInteraction, PermissionFlagsBits} from 'discord.js';
import {setupCommandTest, expectReplyTextContains} from '@zeffuro/fakegaming-common/testing';

describe('test-notification command', () => {
    it('sends a test notification to the current channel for admins', async () => {
        const send = vi.fn().mockResolvedValue({id: 'msg'});
        const {command, interaction} = await setupCommandTest(
            'modules/general/commands/testNotification.js',
            {
                interaction: {
                    stringOptions: {message: 'Custom test'},
                    memberPermissions: {has: vi.fn().mockReturnValue(true)},
                    channel: {send, toString: () => '<#chan>'},
                },
            }
        );

        await command.execute(interaction as unknown as ChatInputCommandInteraction);

        expect((interaction as ChatInputCommandInteraction).memberPermissions?.has).toHaveBeenCalledWith(PermissionFlagsBits.Administrator);
        expect(send).toHaveBeenCalledWith(expect.objectContaining({content: 'Custom test'}));
        expectReplyTextContains(interaction, 'Sent a test notification to <#chan>.');
    });
});
