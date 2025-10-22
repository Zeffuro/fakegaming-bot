import { describe, it, vi, beforeEach } from 'vitest';
import { setupCommandTest, createMockQuote } from '@zeffuro/fakegaming-common/testing';
import { ChatInputCommandInteraction } from 'discord.js';
import { assertSearchCalled, expectReplyContains } from './helpers/quotesTestHelpers.js';

describe('searchQuote command', () => {
    beforeEach(() => {
        // Reset mock call history without tearing down module graph
        vi.clearAllMocks();
        vi.restoreAllMocks();
    });

    // Helper to setup the command with common options
    async function setupSearchCommand(searchQuotesSpy: (guildId: string, text: string) => Promise<unknown>, searchText: string, guildId = '135381928284343204') {
        const { command, interaction } = await setupCommandTest(
            'modules/quotes/commands/searchQuote.js',
            {
                interaction: {
                    stringOptions: { text: searchText },
                    guildId
                },
                managerOverrides: {
                    quoteManager: {
                        searchQuotes: searchQuotesSpy
                    }
                }
            }
        );
        return { command, interaction };
    }

    it('displays quotes matching the search text', async () => {
        // Create mock quotes that match the search text
        const mockQuotes = [
            createMockQuote({
                quote: 'This is a test quote with the keyword',
                authorId: '234567890123456789',
                guildId: '135381928284343204',
                timestamp: 1633027200000 // October 1, 2021
            }),
            createMockQuote({
                quote: 'Another test quote with the keyword',
                authorId: '345678901234567890',
                guildId: '135381928284343204',
                timestamp: 1633113600000 // October 2, 2021
            })
        ];

        const searchText = 'keyword';

        // Create spy for searchQuotes
        const searchQuotesSpy = vi.fn().mockResolvedValue(mockQuotes);

        // Setup the test environment
        const { command, interaction } = await setupSearchCommand(searchQuotesSpy, searchText);

        // Execute the command
        await command.execute(interaction as unknown as ChatInputCommandInteraction);

        // Verify searchQuotes was called with the correct parameters
        assertSearchCalled(searchQuotesSpy as any, '135381928284343204', searchText);

        // Verify the interaction reply contains all matching quotes
        expectReplyContains(interaction, [
            `Quotes matching "${searchText}":`,
            'This is a test quote with the keyword',
            'Another test quote with the keyword'
        ]);
    });

    it('shows appropriate message when no matching quotes are found', async () => {
        // Create spy for searchQuotes that returns empty array
        const searchQuotesSpy = vi.fn().mockResolvedValue([]);
        const searchText = 'nonexistent';

        // Setup the test environment
        const { command, interaction } = await setupSearchCommand(searchQuotesSpy, searchText);

        // Execute the command
        await command.execute(interaction as unknown as ChatInputCommandInteraction);

        // Verify searchQuotes was called with the correct parameters
        assertSearchCalled(searchQuotesSpy as any, '135381928284343204', searchText);

        // Verify the interaction reply shows the "no quotes" message
        expectReplyContains(interaction, ['No quotes found matching your search.']);
    });
});
