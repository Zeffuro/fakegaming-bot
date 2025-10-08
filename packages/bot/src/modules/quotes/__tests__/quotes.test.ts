import { describe, it, expect, vi, beforeEach } from 'vitest';
import { setupCommandTest, createMockQuote } from '@zeffuro/fakegaming-common/testing';
import { ChatInputCommandInteraction } from 'discord.js';

describe('quotes command', () => {
    beforeEach(() => {
        // Reset all mocks and clear module cache before each test
        vi.resetAllMocks();
        vi.resetModules();
    });

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

        // Create mock user
        const mockUser = {
            id: '234567890123456789',
            tag: 'testAuthor#1234'
        };

        // Setup the test environment
        const { command, interaction } = await setupCommandTest(
            'modules/quotes/commands/quotes.js',
            {
                interaction: {
                    options: {
                        getUser: vi.fn().mockReturnValue(mockUser)
                    },
                    guildId: '135381928284343204'
                },
                managerOverrides: {
                    quoteManager: {
                        getQuotesByAuthor: getQuotesByAuthorSpy
                    }
                }
            }
        );

        // Execute the command
        await command.execute(interaction as unknown as ChatInputCommandInteraction);

        // Verify getQuotesByAuthor was called with the correct parameters
        expect(getQuotesByAuthorSpy).toHaveBeenCalledWith('135381928284343204', '234567890123456789');

        // Verify the interaction reply contains both quotes
        expect(interaction.reply).toHaveBeenCalledWith(
            expect.stringContaining(`Quotes for ${mockUser.tag}:`)
        );
        expect(interaction.reply).toHaveBeenCalledWith(
            expect.stringContaining('First test quote')
        );
        expect(interaction.reply).toHaveBeenCalledWith(
            expect.stringContaining('Second test quote')
        );
    });

    it('shows appropriate message when no quotes are found', async () => {
        // Create spy for getQuotesByAuthor that returns empty array
        const getQuotesByAuthorSpy = vi.fn().mockResolvedValue([]);

        // Create mock user
        const mockUser = {
            id: '234567890123456789',
            tag: 'testAuthor#1234'
        };

        // Setup the test environment
        const { command, interaction } = await setupCommandTest(
            'modules/quotes/commands/quotes.js',
            {
                interaction: {
                    options: {
                        getUser: vi.fn().mockReturnValue(mockUser)
                    },
                    guildId: '135381928284343204'
                },
                managerOverrides: {
                    quoteManager: {
                        getQuotesByAuthor: getQuotesByAuthorSpy
                    }
                }
            }
        );

        // Execute the command
        await command.execute(interaction as unknown as ChatInputCommandInteraction);

        // Verify getQuotesByAuthor was called
        expect(getQuotesByAuthorSpy).toHaveBeenCalled();

        // Verify the interaction reply shows "no quotes found" message
        expect(interaction.reply).toHaveBeenCalledWith(
            `No quotes found for ${mockUser.tag}.`
        );
    });
});
