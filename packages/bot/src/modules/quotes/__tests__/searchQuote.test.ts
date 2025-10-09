// filepath: f:\Coding\discord-bot\packages\bot\src\modules\quotes\__tests__\searchQuote.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { setupCommandTest, createMockQuote } from '@zeffuro/fakegaming-common/testing';
import { ChatInputCommandInteraction } from 'discord.js';

describe('searchQuote command', () => {
    beforeEach(() => {
        // Reset all mocks and clear module cache before each test
        vi.resetAllMocks();
        vi.resetModules();
    });

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
        const { command, interaction } = await setupCommandTest(
            'modules/quotes/commands/searchQuote.js',
            {
                interaction: {
                    options: {
                        getString: vi.fn((_name, _required) => {
                            return searchText;
                        })
                    },
                    guildId: '135381928284343204'
                },
                managerOverrides: {
                    quoteManager: {
                        searchQuotes: searchQuotesSpy
                    }
                }
            }
        );

        // Execute the command
        await command.execute(interaction as unknown as ChatInputCommandInteraction);

        // Verify searchQuotes was called with the correct parameters
        expect(searchQuotesSpy).toHaveBeenCalledWith('135381928284343204', searchText);

        // Verify the interaction reply contains all matching quotes
        expect(interaction.reply).toHaveBeenCalledWith(
            expect.stringContaining(`Quotes matching "${searchText}":`)
        );
        expect(interaction.reply).toHaveBeenCalledWith(
            expect.stringContaining('This is a test quote with the keyword')
        );
        expect(interaction.reply).toHaveBeenCalledWith(
            expect.stringContaining('Another test quote with the keyword')
        );
    });

    it('shows appropriate message when no matching quotes are found', async () => {
        // Create spy for searchQuotes that returns empty array
        const searchQuotesSpy = vi.fn().mockResolvedValue([]);
        const searchText = 'nonexistent';

        // Setup the test environment
        const { command, interaction } = await setupCommandTest(
            'modules/quotes/commands/searchQuote.js',
            {
                interaction: {
                    options: {
                        getString: vi.fn().mockReturnValue(searchText)
                    },
                    guildId: '135381928284343204'
                },
                managerOverrides: {
                    quoteManager: {
                        searchQuotes: searchQuotesSpy
                    }
                }
            }
        );

        // Execute the command
        await command.execute(interaction as unknown as ChatInputCommandInteraction);

        // Verify searchQuotes was called with the correct parameters
        expect(searchQuotesSpy).toHaveBeenCalledWith('135381928284343204', searchText);

        // Verify the interaction reply shows the "no quotes" message
        expect(interaction.reply).toHaveBeenCalledWith('No quotes found matching your search.');
    });
});
