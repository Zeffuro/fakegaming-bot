import { describe, it, vi, beforeEach } from 'vitest';
import { setupCommandTest, createMockQuote } from '@zeffuro/fakegaming-common/testing';
import { ChatInputCommandInteraction } from 'discord.js';
import { assertGetByGuildCalled, expectReplyContains } from './helpers/quotesTestHelpers.js';

describe('randomQuote command', () => {
    beforeEach(() => {
        // Reset mock call history without tearing down module graph
        vi.clearAllMocks();
        vi.restoreAllMocks();

        // Mock Math.random to return a consistent value for testing
        vi.spyOn(global.Math, 'random').mockReturnValue(0.5);
    });

    // Helper to setup the command with common options
    async function setupRandomCommand(getQuotesByGuildSpy: (guildId: string) => Promise<unknown>, guildId = '135381928284343204') {
        const { command, interaction } = await setupCommandTest(
            'modules/quotes/commands/randomQuote.js',
            {
                interaction: {
                    guildId
                },
                managerOverrides: {
                    quoteManager: {
                        getQuotesByGuild: getQuotesByGuildSpy
                    }
                }
            }
        );
        return { command, interaction };
    }

    it('displays a random quote from the server', async () => {
        // Create mock quotes for the server
        const mockQuotes = [
            createMockQuote({
                quote: 'First test quote',
                authorId: '234567890123456789',
                guildId: '135381928284343204',
                timestamp: 1633027200000 // October 1, 2021
            }),
            createMockQuote({
                quote: 'Second test quote',
                authorId: '345678901234567890',
                guildId: '135381928284343204',
                timestamp: 1633113600000 // October 2, 2021
            })
        ];

        // Create spy for getQuotesByGuild
        const getQuotesByGuildSpy = vi.fn().mockResolvedValue(mockQuotes);

        // Setup the test environment
        const { command, interaction } = await setupRandomCommand(getQuotesByGuildSpy);

        // Execute the command
        await command.execute(interaction as unknown as ChatInputCommandInteraction);

        // Verify getQuotesByGuild was called with the correct parameters
        assertGetByGuildCalled(getQuotesByGuildSpy as any, '135381928284343204');

        // With Math.random mocked to 0.5, it should pick the 1st quote (index 1)
        expectReplyContains(interaction, ['> Second test quote', '<@345678901234567890>']);
    });

    it('shows appropriate message when no quotes are found', async () => {
        // Create spy for getQuotesByGuild that returns empty array
        const getQuotesByGuildSpy = vi.fn().mockResolvedValue([]);

        // Setup the test environment
        const { command, interaction } = await setupRandomCommand(getQuotesByGuildSpy);

        // Execute the command
        await command.execute(interaction as unknown as ChatInputCommandInteraction);

        // Verify getQuotesByGuild was called with the correct parameters
        assertGetByGuildCalled(getQuotesByGuildSpy as any, '135381928284343204');

        // Verify the interaction reply shows the "no quotes" message
        expectReplyContains(interaction, ['No quotes found for this server.']);
    });
});
