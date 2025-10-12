import { describe, it, expect, vi, beforeEach } from 'vitest';
import { setupCommandTest, expectReplyTextContains } from '@zeffuro/fakegaming-common/testing';
import { ChatInputCommandInteraction } from 'discord.js';

describe('poll command', () => {
    beforeEach(() => {
        // Reset all mocks and clear module cache before each test
        vi.resetAllMocks();
        vi.resetModules();
    });

    it('creates a poll with two options', async () => {
        // Mock for fetchReply
        const mockMessage = {
            react: vi.fn().mockResolvedValue(undefined)
        };

        // Setup the test environment
        const { command, interaction } = await setupCommandTest(
            'modules/general/commands/poll.js',
            {
                interaction: {
                    stringOptions: {
                        question: 'Test poll question?',
                        option1: 'Option One',
                        option2: 'Option Two'
                    },
                    fetchReply: vi.fn().mockResolvedValue(mockMessage)
                }
            }
        );

        // Execute the command
        await command.execute(interaction as unknown as ChatInputCommandInteraction);

        // Verify the interaction reply contains the question and options
        expectReplyTextContains(interaction, '📊 Test poll question?');
        expectReplyTextContains(interaction, '1️⃣ Option One');
        expectReplyTextContains(interaction, '2️⃣ Option Two');

        // Verify fetchReply was called to get the message for adding reactions
        expect(interaction.fetchReply).toHaveBeenCalled();

        // Verify reactions were added to the message
        expect(mockMessage.react).toHaveBeenCalledWith('1️⃣');
        expect(mockMessage.react).toHaveBeenCalledWith('2️⃣');
        // Only 2 reactions should be added
        expect(mockMessage.react).toHaveBeenCalledTimes(2);
    });

    it('creates a poll with maximum number of options', async () => {
        // Mock for fetchReply
        const mockMessage = {
            react: vi.fn().mockResolvedValue(undefined)
        };

        // Setup the test environment
        const { command, interaction } = await setupCommandTest(
            'modules/general/commands/poll.js',
            {
                interaction: {
                    stringOptions: {
                        question: 'Test poll with many options?',
                        option1: 'Option One',
                        option2: 'Option Two',
                        option3: 'Option Three',
                        option4: 'Option Four',
                        option5: 'Option Five'
                    },
                    fetchReply: vi.fn().mockResolvedValue(mockMessage)
                }
            }
        );

        // Execute the command
        await command.execute(interaction as unknown as ChatInputCommandInteraction);

        // Verify the interaction reply contains all options
        expectReplyTextContains(interaction, '📊 Test poll with many options?');
        expectReplyTextContains(interaction, '1️⃣ Option One');
        expectReplyTextContains(interaction, '5️⃣ Option Five');

        // Verify all 5 reactions were added
        expect(mockMessage.react).toHaveBeenCalledTimes(5);
        expect(mockMessage.react).toHaveBeenCalledWith('5️⃣');
    });

    it('handles reaction errors gracefully', async () => {
        // Mock for fetchReply with a react method that fails
        const mockMessage = {
            react: vi.fn()
                .mockResolvedValueOnce(undefined) // First reaction succeeds
                .mockRejectedValueOnce(new Error('Failed to react')) // Second reaction fails
                .mockResolvedValueOnce(undefined) // Third reaction succeeds
        };

        // Setup the test environment
        const { command, interaction } = await setupCommandTest(
            'modules/general/commands/poll.js',
            {
                interaction: {
                    stringOptions: {
                        question: 'Test poll with error?',
                        option1: 'Option One',
                        option2: 'Option Two',
                        option3: 'Option Three'
                    },
                    fetchReply: vi.fn().mockResolvedValue(mockMessage)
                }
            }
        );

        // Execute the command - it should not throw despite the reaction error
        await expect(
            command.execute(interaction as unknown as ChatInputCommandInteraction)
        ).resolves.not.toThrow();

        // Verify the poll was still created
        expect((interaction.reply as any).mock.calls.length).toBeGreaterThan(0);

        // Verify all 3 react methods were called despite the error
        expect(mockMessage.react).toHaveBeenCalledTimes(3);
    });
});
