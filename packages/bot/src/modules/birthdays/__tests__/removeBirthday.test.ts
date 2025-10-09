import { describe, it, expect, vi, beforeEach } from 'vitest';
import { setupCommandTest } from '@zeffuro/fakegaming-common/testing';
import { CommandInteraction } from 'discord.js';

describe('removeBirthday command', () => {
    beforeEach(() => {
        // Reset all mocks and clear module cache before each test
        vi.resetAllMocks();
        vi.resetModules();
    });

    it('removes user\'s own birthday', async () => {
        // Create a mock for removeBirthday
        const removeBirthdaySpy = vi.fn().mockResolvedValue(true);

        // Setup the test environment
        const { command, interaction } = await setupCommandTest(
            'modules/birthdays/commands/removeBirthday.js',
            {
                interaction: {
                    user: { id: '123456789012345678' },
                    guildId: '135381928284343204'
                },
                managerOverrides: {
                    birthdayManager: {
                        removeBirthday: removeBirthdaySpy
                    }
                }
            }
        );

        // Execute the command
        await command.execute(interaction as unknown as CommandInteraction);

        // Verify removeBirthday was called with correct parameters
        expect(removeBirthdaySpy).toHaveBeenCalledWith('123456789012345678', '135381928284343204');

        // Verify the interaction reply
        expect(interaction.reply).toHaveBeenCalledWith(
            expect.objectContaining({
                content: expect.stringContaining('Your birthday has been removed'),
                flags: expect.anything()
            })
        );
    });

    it('allows admin to remove another user\'s birthday', async () => {
        // Target user ID
        const targetUserId = '234567890123456789';

        // Create mocks
        const removeBirthdaySpy = vi.fn().mockResolvedValue(true);
        const requireAdminSpy = vi.fn().mockResolvedValue(true); // User is admin

        // Mock the requireAdmin function
        vi.doMock('../../../utils/permissions.js', () => ({
            requireAdmin: requireAdminSpy
        }));

        // Setup the test environment with target user option
        const { command, interaction } = await setupCommandTest(
            'modules/birthdays/commands/removeBirthday.js',
            {
                interaction: {
                    user: { id: '123456789012345678' },
                    guildId: '135381928284343204',
                    options: {
                        getUser: vi.fn((name) => name === 'user' ? { id: targetUserId } : null)
                    }
                },
                managerOverrides: {
                    birthdayManager: {
                        removeBirthday: removeBirthdaySpy
                    }
                }
            }
        );

        // Execute the command
        await command.execute(interaction as unknown as CommandInteraction);

        // Verify requireAdmin was called
        expect(requireAdminSpy).toHaveBeenCalledWith(interaction);

        // Verify removeBirthday was called with the target user's ID
        expect(removeBirthdaySpy).toHaveBeenCalledWith(targetUserId, '135381928284343204');

        // Verify the interaction reply mentions the target user
        expect(interaction.reply).toHaveBeenCalledWith(
            expect.objectContaining({
                content: expect.stringContaining(`<@${targetUserId}>'s birthday has been removed`),
                flags: expect.anything()
            })
        );
    });

    it('prevents non-admin from removing another user\'s birthday', async () => {
        // Target user ID
        const targetUserId = '234567890123456789';

        // Create mocks
        const removeBirthdaySpy = vi.fn().mockResolvedValue(true);
        const requireAdminSpy = vi.fn().mockResolvedValue(false); // User is NOT admin

        // Mock the requireAdmin function
        vi.doMock('../../../utils/permissions.js', () => ({
            requireAdmin: requireAdminSpy
        }));

        // Setup the test environment with target user option
        const { command, interaction } = await setupCommandTest(
            'modules/birthdays/commands/removeBirthday.js',
            {
                interaction: {
                    user: { id: '123456789012345678' },
                    guildId: '135381928284343204',
                    options: {
                        getUser: vi.fn((name) => name === 'user' ? { id: targetUserId } : null)
                    }
                },
                managerOverrides: {
                    birthdayManager: {
                        removeBirthday: removeBirthdaySpy
                    }
                }
            }
        );

        // Execute the command
        await command.execute(interaction as unknown as CommandInteraction);

        // Verify requireAdmin was called
        expect(requireAdminSpy).toHaveBeenCalledWith(interaction);

        // Verify removeBirthday was NOT called
        expect(removeBirthdaySpy).not.toHaveBeenCalled();
    });
});
