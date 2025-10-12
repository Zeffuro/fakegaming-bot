import { describe, it, vi, beforeEach } from 'vitest';
import { setupCommandTest, expectReplyTextContains } from '@zeffuro/fakegaming-common/testing';
import { ChatInputCommandInteraction } from 'discord.js';

describe('roll command', () => {
    beforeEach(() => {
        // Reset all mocks and clear module cache before each test
        vi.resetAllMocks();
        vi.resetModules();

        // Mock Math.random to return predictable values for testing
        vi.spyOn(global.Math, 'random')
            .mockReturnValueOnce(0.5) // First call: 0.5
            .mockReturnValueOnce(0.1) // Second call: 0.1
            .mockReturnValueOnce(0.9); // Third call: 0.9
    });

    it('rolls default 1d6 when no input is provided', async () => {
        // Setup the test environment
        const { command, interaction } = await setupCommandTest(
            'modules/general/commands/roll.js',
            {
                interaction: {
                    // no stringOptions means getString('dice') returns null
                }
            }
        );

        // Execute the command
        await command.execute(interaction as unknown as ChatInputCommandInteraction);

        // With Math.random mocked to return 0.5, a 1d6 roll would be 4 (0.5 * 6 + 1, rounded down)
        expectReplyTextContains(interaction, '🎲 You rolled a **4** (1d6)');
    });

    it('handles standard dice notation (e.g., 3d8)', async () => {
        // Setup the test environment
        const { command, interaction } = await setupCommandTest(
            'modules/general/commands/roll.js',
            {
                interaction: {
                    stringOptions: { dice: '3d8' }
                }
            }
        );

        // Execute the command
        await command.execute(interaction as unknown as ChatInputCommandInteraction);

        // With Math.random mocked, total should be 14 with rolls 5,1,8
        expectReplyTextContains(interaction, '🎲 You rolled: 5, 1, 8 (Total: **14**) [3d8]');
    });

    it('handles maximum number input (e.g., 100)', async () => {
        // Setup the test environment
        const { command, interaction } = await setupCommandTest(
            'modules/general/commands/roll.js',
            {
                interaction: {
                    stringOptions: { dice: '100' }
                }
            }
        );

        // Execute the command
        await command.execute(interaction as unknown as ChatInputCommandInteraction);

        // With Math.random = 0.5, the result should be 51
        expectReplyTextContains(interaction, '🎲 You rolled a **51** (1-100)');
    });

    it('rejects dice with too many dice or sides', async () => {
        // Setup the test environment with an unreasonable number of dice
        const { command, interaction } = await setupCommandTest(
            'modules/general/commands/roll.js',
            {
                interaction: {
                    stringOptions: { dice: '50d2000' }
                }
            }
        );

        // Execute the command
        await command.execute(interaction as unknown as ChatInputCommandInteraction);

        // Should reject with an error message
        expectReplyTextContains(interaction, 'Please use a reasonable dice notation');
    });

    it('handles invalid input gracefully', async () => {
        // Setup the test environment with invalid input
        const { command, interaction } = await setupCommandTest(
            'modules/general/commands/roll.js',
            {
                interaction: {
                    stringOptions: { dice: 'not-a-dice' }
                }
            }
        );

        // Execute the command
        await command.execute(interaction as unknown as ChatInputCommandInteraction);

        // Should show an error message
        expectReplyTextContains(interaction, 'Invalid input');
    });

    it('handles shorthand dice notation (e.g., d20)', async () => {
        // Setup the test environment with shorthand notation
        const { command, interaction } = await setupCommandTest(
            'modules/general/commands/roll.js',
            {
                interaction: {
                    stringOptions: { dice: 'd20' }
                }
            }
        );

        // Execute the command
        await command.execute(interaction as unknown as ChatInputCommandInteraction);

        // With Math.random = 0.5, the result should be 11
        expectReplyTextContains(interaction, '🎲 You rolled: 11 (Total: **11**) [1d20]');
    });
});
