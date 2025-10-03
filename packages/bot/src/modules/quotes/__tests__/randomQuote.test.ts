// filepath: f:\Coding\discord-bot\packages\bot\src\modules\quotes\__tests__\randomQuote.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { setupCommandTest, createMockQuote } from '@zeffuro/fakegaming-common/testing';
import { ChatInputCommandInteraction } from 'discord.js';

describe('randomQuote command', () => {
    beforeEach(() => {
        // Reset all mocks and clear module cache before each test
        vi.resetAllMocks();
        vi.resetModules();
        
        // Mock Math.random to return a consistent value for testing
        vi.spyOn(global.Math, 'random').mockReturnValue(0.5);
    });

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
        const { command, interaction } = await setupCommandTest(
            'modules/quotes/commands/randomQuote.js',
            {
                interaction: {
                    guildId: '135381928284343204'
                },
                managerOverrides: {
                    quoteManager: {
                        getQuotesByGuild: getQuotesByGuildSpy
                    }
                }
            }
        );

        // Execute the command
        await command.execute(interaction as unknown as ChatInputCommandInteraction);

        // Verify getQuotesByGuild was called with the correct parameters
        expect(getQuotesByGuildSpy).toHaveBeenCalledWith({
            guildId: '135381928284343204'
        });

        // With Math.random mocked to 0.5, it should pick the 1st quote (index 1)
        // Since Math.floor(0.5 * 2) = 1
        const expectedQuote = mockQuotes[1];
        const date = new Date(expectedQuote.timestamp).toLocaleString();

        // Verify the interaction reply contains the selected quote
        expect(interaction.reply).toHaveBeenCalledWith(
            `> ${expectedQuote.quote}\n— <@${expectedQuote.authorId}> (${date})`
        );
    });

    it('shows appropriate message when no quotes are found', async () => {
        // Create spy for getQuotesByGuild that returns empty array
        const getQuotesByGuildSpy = vi.fn().mockResolvedValue([]);

        // Setup the test environment
        const { command, interaction } = await setupCommandTest(
            'modules/quotes/commands/randomQuote.js',
            {
                interaction: {
                    guildId: '135381928284343204'
                },
                managerOverrides: {
                    quoteManager: {
                        getQuotesByGuild: getQuotesByGuildSpy
                    }
                }
            }
        );

        // Execute the command
        await command.execute(interaction as unknown as ChatInputCommandInteraction);

        // Verify getQuotesByGuild was called with the correct parameters
        expect(getQuotesByGuildSpy).toHaveBeenCalledWith({
            guildId: '135381928284343204'
        });

        // Verify the interaction reply shows the "no quotes" message
        expect(interaction.reply).toHaveBeenCalledWith('No quotes found for this server.');
    });
});
