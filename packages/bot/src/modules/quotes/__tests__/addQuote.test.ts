import { describe, it, expect, vi, beforeEach } from 'vitest';
import { setupCommandTest, expectReplyTextContains } from '@zeffuro/fakegaming-common/testing';
import { ChatInputCommandInteraction } from 'discord.js';

// Mock the uuid library
vi.mock('uuid', () => ({
    v4: vi.fn().mockReturnValue('mock-uuid-1234')
}));

describe('addQuote command', () => {
    beforeEach(() => {
        // Reset all mocks and clear module cache before each test
        vi.resetAllMocks();
        vi.resetModules();
    });

    it('adds a quote for a specified user', async () => {
        // Create mock for quote manager's upsertQuote method
        const quoteData = {
            id: 'mock-uuid-1234',
            guildId: '135381928284343204',
            quote: 'This is a test quote',
            authorId: '234567890123456789',
            submitterId: '123456789012345678',
            timestamp: expect.any(Number)
        };
        const addSpy = vi.fn().mockResolvedValue({ created: true, ...quoteData });

        // Setup the test environment with builder options
        const { command, interaction } = await setupCommandTest(
            'modules/quotes/commands/addQuote.js',
            {
                interaction: {
                    stringOptions: { quote: 'This is a test quote' },
                    userOptions: { author: '234567890123456789' },
                    user: { id: '123456789012345678', tag: 'testSubmitter#1234' },
                    guildId: '135381928284343204'
                },
                managerOverrides: {
                    quoteManager: {
                        upsertQuote: addSpy
                    }
                }
            }
        );

        // Execute the command
        await command.execute(interaction as unknown as ChatInputCommandInteraction);

        // Verify quote manager's upsertQuote method was called with the correct parameters
        expect(addSpy).toHaveBeenCalledWith({
            id: 'mock-uuid-1234',
            guildId: '135381928284343204',
            quote: 'This is a test quote',
            authorId: '234567890123456789',
            submitterId: '123456789012345678',
            timestamp: expect.any(Number)
        });

        // Verify the interaction reply contains the success text
        expectReplyTextContains(interaction, 'Quote added');
    });

    it('handles missing required parameters', async () => {
        // Setup the test environment with missing required options (no stringOptions/userOptions)
        const { command, interaction } = await setupCommandTest(
            'modules/quotes/commands/addQuote.js',
            {
                interaction: {
                    user: { id: '123456789012345678' },
                    guildId: '135381928284343204'
                }
            }
        );

        // Execute the command - it should throw due to missing required 'quote'
        await expect(
            command.execute(interaction as unknown as ChatInputCommandInteraction)
        ).rejects.toThrow(/Required\s+string\s+option\s+'quote'\s+is\s+missing/);
    });
});
