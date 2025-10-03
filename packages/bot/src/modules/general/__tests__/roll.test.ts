import { describe, it, expect, vi, beforeEach } from 'vitest';
import { setupCommandTest } from '@zeffuro/fakegaming-common/testing';
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
                    options: {
                        getString: vi.fn(() => null) // No dice input provided
                    }
                }
            }
        );

        // Execute the command
        await command.execute(interaction as unknown as ChatInputCommandInteraction);

        // With Math.random mocked to return 0.5, a 1d6 roll would be 4 (0.5 * 6 + 1, rounded down)
        expect(interaction.reply).toHaveBeenCalledWith(
            expect.stringMatching(/🎲 You rolled a \*\*4\*\* \(1d6\)/)
        );
    });

    it('handles standard dice notation (e.g., 3d8)', async () => {
        // Setup the test environment
        const { command, interaction } = await setupCommandTest(
            'modules/general/commands/roll.js',
            {
                interaction: {
                    options: {
                        getString: vi.fn(() => '3d8') // Roll 3d8
                    }
                }
            }
        );

        // Execute the command
        await command.execute(interaction as unknown as ChatInputCommandInteraction);

        // With Math.random mocked:
        // First roll: 0.5 * 8 + 1 = 5
        // Second roll: 0.1 * 8 + 1 = 1.8 ≈ 1
        // Third roll: 0.9 * 8 + 1 = 8.2 ≈ 8
        // Total: 5 + 1 + 8 = 14
        expect(interaction.reply).toHaveBeenCalledWith(
            expect.stringMatching(/🎲 You rolled: 5, 1, 8 \(Total: \*\*14\*\*\) \[3d8\]/)
        );
    });

    it('handles maximum number input (e.g., 100)', async () => {
        // Setup the test environment
        const { command, interaction } = await setupCommandTest(
            'modules/general/commands/roll.js',
            {
                interaction: {
                    options: {
                        getString: vi.fn(() => '100') // Random number between 1-100
                    }
                }
            }
        );

        // Execute the command
        await command.execute(interaction as unknown as ChatInputCommandInteraction);

        // With Math.random = 0.5, the result should be 51 (0.5 * 100 + 1, rounded down)
        expect(interaction.reply).toHaveBeenCalledWith(
            expect.stringMatching(/🎲 You rolled a \*\*51\*\* \(1-100\)/)
        );
    });

    it('rejects dice with too many dice or sides', async () => {
        // Setup the test environment with an unreasonable number of dice
        const { command, interaction } = await setupCommandTest(
            'modules/general/commands/roll.js',
            {
                interaction: {
                    options: {
                        getString: vi.fn(() => '50d2000') // Too many dice and sides
                    }
                }
            }
        );

        // Execute the command
        await command.execute(interaction as unknown as ChatInputCommandInteraction);

        // Should reject with an error message
        expect(interaction.reply).toHaveBeenCalledWith(
            expect.stringMatching(/Please use a reasonable dice notation/)
        );
    });

    it('handles invalid input gracefully', async () => {
        // Setup the test environment with invalid input
        const { command, interaction } = await setupCommandTest(
            'modules/general/commands/roll.js',
            {
                interaction: {
                    options: {
                        getString: vi.fn(() => 'not-a-dice') // Invalid input
                    }
                }
            }
        );

        // Execute the command
        await command.execute(interaction as unknown as ChatInputCommandInteraction);

        // Should show an error message
        expect(interaction.reply).toHaveBeenCalledWith(
            expect.stringMatching(/Invalid input/)
        );
    });

    it('handles shorthand dice notation (e.g., d20)', async () => {
        // Setup the test environment with shorthand notation
        const { command, interaction } = await setupCommandTest(
            'modules/general/commands/roll.js',
            {
                interaction: {
                    options: {
                        getString: vi.fn(() => 'd20') // Shorthand for 1d20
                    }
                }
            }
        );

        // Execute the command
        await command.execute(interaction as unknown as ChatInputCommandInteraction);

        // With Math.random = 0.5, the result should be 11 (0.5 * 20 + 1, rounded down)
        expect(interaction.reply).toHaveBeenCalledWith(
            expect.stringMatching(/🎲 You rolled: 11 \(Total: \*\*11\*\*\) \[1d20\]/)
        );
    });
});
