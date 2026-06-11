import {describe, it, expect, vi} from 'vitest';
import {ChatInputCommandInteraction} from 'discord.js';
import {setupCommandTest, expectReplyTextContains} from '@zeffuro/fakegaming-common/testing';

const quoteRows = [
    {id: 'quote-one', guildId: 'guild', quote: 'First quote', authorId: '123456789012345678', submitterId: 'other'},
    {id: 'quote-two', guildId: 'guild', quote: 'Second quote', authorId: 'author-2', submitterId: '123456789012345678'},
    {id: 'quote-three', guildId: 'guild', quote: 'Third quote', authorId: 'author-2', submitterId: 'other'},
];

describe('quote enhancements', () => {
    it('deletes a quote authored by the user', async () => {
        const removeByPk = vi.fn().mockResolvedValue(undefined);
        const {command, interaction} = await setupCommandTest(
            'modules/quotes/commands/deleteQuote.js',
            {
                interaction: {
                    stringOptions: {id: 'quote-one'},
                    guildId: 'guild',
                    user: {id: '123456789012345678'},
                },
                managerOverrides: {
                    quoteManager: {
                        getQuotesByGuild: vi.fn().mockResolvedValue(quoteRows),
                        removeByPk,
                    },
                },
            }
        );

        await command.execute(interaction as unknown as ChatInputCommandInteraction);

        expect(removeByPk).toHaveBeenCalledWith('quote-one');
        expectReplyTextContains(interaction, 'Deleted quote');
    });

    it('shows a leaderboard by quote author', async () => {
        const {command, interaction} = await setupCommandTest(
            'modules/quotes/commands/quoteLeaderboard.js',
            {
                interaction: {guildId: 'guild'},
                managerOverrides: {
                    quoteManager: {getQuotesByGuild: vi.fn().mockResolvedValue(quoteRows)},
                },
            }
        );

        await command.execute(interaction as unknown as ChatInputCommandInteraction);

        expectReplyTextContains(interaction, 'Quote leaderboard:');
        expectReplyTextContains(interaction, '<@author-2> - 2 quotes');
    });
});
