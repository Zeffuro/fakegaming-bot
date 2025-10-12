import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest';
import { setupCommandTest, expectEphemeralReply, expectReplyTextContains } from '@zeffuro/fakegaming-common/testing';
import { CommandInteraction, Collection } from 'discord.js';

describe('help command', () => {
    beforeEach(() => {
        // Reset all mocks and clear module cache before each test
        vi.resetAllMocks();
        vi.resetModules();
    });

    it('lists all available commands', async () => {
        // Create a mock commands collection
        const mockCommands = new Collection();
        mockCommands.set('test-command1', {
            data: {
                name: 'test-command1',
                description: 'This is test command 1'
            }
        });
        mockCommands.set('test-command2', {
            data: {
                name: 'test-command2',
                description: 'This is test command 2'
            }
        });
        mockCommands.set('help', {
            data: {
                name: 'help',
                description: 'List all available commands and their descriptions.'
            }
        });

        // Setup the test environment with a mock client that has commands
        const { command, interaction } = await setupCommandTest(
            'modules/general/commands/help.js',
            {
                interaction: {
                    client: {
                        commands: mockCommands
                    }
                }
            }
        );

        // Execute the command
        await command.execute(interaction as unknown as CommandInteraction);

        // Verify ephemeral reply and contents
        expectEphemeralReply(interaction);
        expectReplyTextContains(interaction, '**Available Commands:**');
        expectReplyTextContains(interaction, '/help');
        expectReplyTextContains(interaction, '/test-command1');
        expectReplyTextContains(interaction, '/test-command2');
    });

    it('sorts commands alphabetically', async () => {
        // Create a mock commands collection with intentionally unsorted names
        const mockCommands = new Collection();
        mockCommands.set('zebra', {
            data: {
                name: 'zebra',
                description: 'A command that starts with Z'
            }
        });
        mockCommands.set('apple', {
            data: {
                name: 'apple',
                description: 'A command that starts with A'
            }
        });
        mockCommands.set('middle', {
            data: {
                name: 'middle',
                description: 'A command in the middle'
            }
        });

        // Setup the test environment with a mock client that has commands
        const { command, interaction } = await setupCommandTest(
            'modules/general/commands/help.js',
            {
                interaction: {
                    client: {
                        commands: mockCommands
                    }
                }
            }
        );

        // Execute the command
        await command.execute(interaction as unknown as CommandInteraction);

        // Extract the reply content and assert order
        const replyPayload = (interaction.reply as unknown as Mock).mock.calls[0][0] as { content: string };
        const replyContent = replyPayload.content;
        const appleIndex = replyContent.indexOf('/apple');
        const middleIndex = replyContent.indexOf('/middle');
        const zebraIndex = replyContent.indexOf('/zebra');

        expect(appleIndex).toBeLessThan(middleIndex);
        expect(middleIndex).toBeLessThan(zebraIndex);
    });
});
