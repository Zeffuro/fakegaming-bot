import { describe, it, expect, vi, beforeEach, Mock } from 'vitest';
import { setupCommandTest } from '@zeffuro/fakegaming-common/testing';
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
                    options: {
                        getString: vi.fn((name: string) => {
                            if (name === 'name1') return 'Alice';
                            return null;
                        })
                    }
                }
            }
        );

        // Execute the command
        await command.execute(interaction as unknown as ChatInputCommandInteraction);

        // Verify the interaction shows an error about needing at least two names
        expect(interaction.reply).toHaveBeenCalledWith('Please provide at least two names.');

        // Verify we don't attempt to start the spinning animation
        expect(interaction.editReply).not.toHaveBeenCalled();
    });

    it('spins the wheel and selects a winner', async () => {
        // Setup the test environment with multiple names
        const { command, interaction } = await setupCommandTest(
            'modules/general/commands/spin.js',
            {
                interaction: {
                    options: {
                        getString: vi.fn((name: string) => {
                            if (name === 'name1') return 'Alice';
                            if (name === 'name2') return 'Bob';
                            if (name === 'name3') return 'Charlie';
                            return null;
                        })
                    }
                }
            }
        );

        // Execute the command
        await command.execute(interaction as unknown as ChatInputCommandInteraction);

        // Verify the interaction starts with the spinning message
        expect(interaction.reply).toHaveBeenCalledWith('Spinning the wheel...');

        // Verify we attempt to edit the reply multiple times during the animation
        expect(interaction.editReply).toHaveBeenCalled();

        // Verify the final message announces a winner
        // With Math.random mocked to 0.5, cycles will be 10 + Math.floor(0.5 * 5) = 12
        // After 12 cycles with 3 names, current will be 12 % 3 = 0
        // So the winner should be 'Alice'
        expect(interaction.editReply).toHaveBeenLastCalledWith(expect.stringMatching(/🎉 The wheel stopped at: \*\*Alice\*\*!/));
    });

    it('handles trimmed whitespace in names', async () => {
        // Setup the test environment with names that have whitespace
        const { command, interaction } = await setupCommandTest(
            'modules/general/commands/spin.js',
            {
                interaction: {
                    options: {
                        getString: vi.fn((name: string) => {
                            if (name === 'name1') return '  Alice  ';
                            if (name === 'name2') return ' Bob ';
                            return null;
                        })
                    }
                }
            }
        );

        // Execute the command
        await command.execute(interaction as unknown as ChatInputCommandInteraction);

        // Verify that the command processed the names by trimming whitespace
        // In one of the intermediate edits, we should see the trimmed name
        const editReplyCalls = (interaction.editReply as Mock).mock.calls;
        const containsTrimmedName = editReplyCalls.some((call: any[]) =>
            call[0].includes('Alice') && !call[0].includes('  Alice  ')
        );

        expect(containsTrimmedName).toBe(true);
    });

    it('supports the maximum number of names (10)', async () => {
        // Setup the test environment with 10 names
        const { command, interaction } = await setupCommandTest(
            'modules/general/commands/spin.js',
            {
                interaction: {
                    options: {
                        getString: vi.fn((name: string) => {
                            const nameIndex = parseInt(name.replace('name', ''), 10);
                            if (nameIndex >= 1 && nameIndex <= 10) {
                                return `Person ${nameIndex}`;
                            }
                            return null;
                        })
                    }
                }
            }
        );

        // Execute the command
        await command.execute(interaction as unknown as ChatInputCommandInteraction);

        // Verify the command executed successfully with all names
        expect(interaction.reply).toHaveBeenCalledWith('Spinning the wheel...');
        expect(interaction.editReply).toHaveBeenCalled();

        // The final message should include one of the names
        expect(interaction.editReply).toHaveBeenLastCalledWith(
            expect.stringMatching(/🎉 The wheel stopped at: \*\*Person \d+\*\*!/)
        );
    });
});
