import { describe, it, expect, vi, beforeEach } from 'vitest';
import { setupCommandTest, createMockQuote } from '@zeffuro/fakegaming-common/testing';
import { ChatInputCommandInteraction } from 'discord.js';
import { assertGetByAuthorCalled, expectReplyContains } from './helpers/quotesTestHelpers.js';

describe('quotes command', () => {
    beforeEach(() => {
        // Reset all mocks and clear module cache before each test
        vi.resetAllMocks();
        vi.resetModules();
    });

    // Helper to setup the command with common options
    async function setupQuotesCommand(getQuotesByAuthorSpy: (guildId: string, authorId: string) => Promise<unknown>, authorId = '234567890123456789', guildId = '135381928284343204') {
        const { command, interaction } = await setupCommandTest(
            'modules/quotes/commands/quotes.js',
            {
                interaction: {
                    userOptions: { user: authorId },
                    guildId
                },
                managerOverrides: {
                    quoteManager: {
                        getQuotesByAuthor: getQuotesByAuthorSpy
                    }
                }
            }
        );
        return { command, interaction };
    }

    it('displays all quotes for a specified user', async () => {
        // Create mock quotes for a specific user
        const mockQuotes = [
            createMockQuote({
                quote: 'First test quote',
                authorId: '234567890123456789',
                guildId: '135381928284343204',
                timestamp: Date.now() - 86400000 // 1 day ago
            }),
            createMockQuote({
                quote: 'Second test quote',
                authorId: '234567890123456789',
                guildId: '135381928284343204',
                timestamp: Date.now() - 3600000 // 1 hour ago
            })
        ];

        // Create spy for getQuotesByAuthor
        const getQuotesByAuthorSpy = vi.fn().mockResolvedValue(mockQuotes);

        // Setup the test environment
        const { command, interaction } = await setupQuotesCommand(getQuotesByAuthorSpy);

        // Execute the command
        await command.execute(interaction as unknown as ChatInputCommandInteraction);

        // Verify getQuotesByAuthor was called with the correct parameters
        assertGetByAuthorCalled(getQuotesByAuthorSpy as any, '135381928284343204', '234567890123456789');

        // Verify the interaction reply contains both quotes
        expectReplyContains(interaction, ['Quotes for', 'First test quote', 'Second test quote']);
    });

    it('shows appropriate message when no quotes are found', async () => {
        // Create spy for getQuotesByAuthor that returns empty array
        const getQuotesByAuthorSpy = vi.fn().mockResolvedValue([]);

        // Setup the test environment
        const { command, interaction } = await setupQuotesCommand(getQuotesByAuthorSpy);

        // Execute the command
        await command.execute(interaction as unknown as ChatInputCommandInteraction);

        // Verify getQuotesByAuthor was called
        expect(getQuotesByAuthorSpy).toHaveBeenCalled();

        // Verify the interaction reply shows "no quotes found" message
        expectReplyContains(interaction, ['No quotes found for']);
    });
});
