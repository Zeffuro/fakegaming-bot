import { describe, it, expect, vi, beforeEach, Mock } from 'vitest';
import { setupCommandTest, expectReplyText } from '@zeffuro/fakegaming-common/testing';
import { ChatInputCommandInteraction } from 'discord.js';

describe('spin command', () => {
    beforeEach(() => {
        // Reset all mocks and clear module cache before each test
        vi.resetAllMocks();
        vi.resetModules();

        // Mock setTimeout to execute immediately
        vi.spyOn(global, 'setTimeout').mockImplementation((callback) => {
            if (typeof callback === 'function') callback();
            return null as any;
        });

        // Mock Math.random for predictable results
        vi.spyOn(global.Math, 'random').mockReturnValue(0.5);
    });

    it('requires at least two names to spin', async () => {
        // Setup the test environment with only one name
        const { command, interaction } = await setupCommandTest(
            'modules/general/commands/spin.js',
            {
                interaction: {
                    stringOptions: { name1: 'Alice' }
                }
            }
        );

        // Execute the command
        await command.execute(interaction as unknown as ChatInputCommandInteraction);

        // Verify the interaction shows an error about needing at least two names
        expectReplyText(interaction, 'Please provide at least two names.');

        // Verify we don't attempt to start the spinning animation
        expect(interaction.editReply).not.toHaveBeenCalled();
    });

    it('spins the wheel and selects a winner', async () => {
        // Setup the test environment with multiple names
        const { command, interaction } = await setupCommandTest(
            'modules/general/commands/spin.js',
            {
                interaction: {
                    stringOptions: { name1: 'Alice', name2: 'Bob', name3: 'Charlie' }
                }
            }
        );

        // Execute the command
        await command.execute(interaction as unknown as ChatInputCommandInteraction);

        // Verify the interaction starts with the spinning message
        expectReplyText(interaction, 'Spinning the wheel...');

        // Verify we attempt to edit the reply multiple times during the animation
        expect(interaction.editReply).toHaveBeenCalled();

        // Verify the final message announces a winner (Alice with current mocks)
        expect((interaction.editReply as any)).toHaveBeenLastCalledWith(expect.stringMatching(/🎉 The wheel stopped at: \*\*Alice\*\*!/));
    });

    it('handles trimmed whitespace in names', async () => {
        // Setup the test environment with names that have whitespace
        const { command, interaction } = await setupCommandTest(
            'modules/general/commands/spin.js',
            {
                interaction: {
                    stringOptions: { name1: '  Alice  ', name2: ' Bob ' }
                }
            }
        );

        // Execute the command
        await command.execute(interaction as unknown as ChatInputCommandInteraction);

        // Verify that the command processed the names by trimming whitespace
        const editReplyCalls = (interaction.editReply as Mock).mock.calls;
        const containsTrimmedName = editReplyCalls.some((call: any[]) =>
            call[0].includes('Alice') && !call[0].includes('  Alice  ')
        );

        expect(containsTrimmedName).toBe(true);
    });

    it('supports the maximum number of names (10)', async () => {
        // Setup the test environment with 10 names
        const names: Record<string, string> = {};
        for (let i = 1; i <= 10; i++) names[`name${i}`] = `Person ${i}`;
        const { command, interaction } = await setupCommandTest(
            'modules/general/commands/spin.js',
            {
                interaction: {
                    stringOptions: names
                }
            }
        );

        // Execute the command
        await command.execute(interaction as unknown as ChatInputCommandInteraction);

        // Verify the command executed successfully with all names
        expectReplyText(interaction, 'Spinning the wheel...');
        expect(interaction.editReply).toHaveBeenCalled();

        // The final message should include one of the names
        expect((interaction.editReply as any)).toHaveBeenLastCalledWith(
            expect.stringMatching(/🎉 The wheel stopped at: \*\*Person \d+\*\*!/)
        );
    });
});
