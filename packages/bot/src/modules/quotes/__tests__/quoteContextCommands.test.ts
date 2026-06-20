import {describe, expect, it, vi} from 'vitest';
import {MessageContextMenuCommandInteraction, type Message, type User, UserContextMenuCommandInteraction} from 'discord.js';
import {
    createMockMessage,
    createMockUser,
    expectEphemeralReply,
    setupCommandTest,
} from '@zeffuro/fakegaming-common/testing';

describe('quote context commands', () => {
    it('shows quotes for the target user', async () => {
        const getQuotesByAuthor = vi.fn().mockResolvedValue([
            {quote: 'Context menus are useful', authorId: 'target-user', timestamp: 1700000000000},
        ]);
        const targetUser = createMockUser({id: 'target-user'} as Partial<User>);
        const {command, interaction} = await setupCommandTest(
            'modules/quotes/commands/showQuotes.js',
            {
                interaction: {
                    guildId: 'guild-1',
                    targetUser,
                },
                managerOverrides: {
                    quoteManager: {
                        getQuotesByAuthor,
                    },
                },
            }
        );

        await command.execute(interaction as unknown as UserContextMenuCommandInteraction);

        expect(getQuotesByAuthor).toHaveBeenCalledWith('guild-1', 'target-user');
        expectEphemeralReply(interaction, {contains: 'Quotes for testuser#0001'});
        expectEphemeralReply(interaction, {contains: 'Context menus are useful'});
    });

    it('saves a target message as a quote', async () => {
        const upsertQuote = vi.fn().mockResolvedValue({created: true});
        const author = createMockUser({id: 'author-user'} as Partial<User>);
        const targetMessage = createMockMessage({
            id: 'message-1',
            content: 'Quote this line',
            author,
            createdTimestamp: 1700000000000,
        } as Partial<Message>);
        const {command, interaction} = await setupCommandTest(
            'modules/quotes/commands/saveMessageAsQuote.js',
            {
                interaction: {
                    guildId: 'guild-1',
                    user: {id: 'submitter-user'},
                    targetMessage,
                },
                managerOverrides: {
                    quoteManager: {
                        upsertQuote,
                    },
                },
            }
        );

        await command.execute(interaction as unknown as MessageContextMenuCommandInteraction);

        expect(upsertQuote).toHaveBeenCalledWith(expect.objectContaining({
            guildId: 'guild-1',
            quote: 'Quote this line',
            authorId: 'author-user',
            submitterId: 'submitter-user',
            timestamp: 1700000000000,
        }));
        expectEphemeralReply(interaction, {contains: 'Saved quote for testuser#0001'});
    });
});
