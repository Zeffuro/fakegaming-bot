import { describe, it, expect, vi, beforeEach } from 'vitest';
import { setupCommandTest, expectReplyTextContains, expectEphemeralReply } from '@zeffuro/fakegaming-common/testing';
import { CommandInteraction } from 'discord.js';

// Hoist mock for requireAdmin to allow per-test configuration via vi.mocked
vi.mock('../../../utils/permissions.js', () => ({
    requireAdmin: vi.fn()
}));

describe('removeBirthday command', () => {
    beforeEach(() => {
        // Reset calls but keep hoisted mocks intact
        vi.clearAllMocks();
    });

    // Local helpers
    async function setupRemoveBirthdayCmd(overrides?: Record<string, unknown>) {
        return setupCommandTest(
            'modules/birthdays/commands/removeBirthday.js',
            overrides ?? {}
        );
    }

    function expectReplyContains(interaction: unknown, substr: string) {
        expectReplyTextContains(interaction, substr);
    }

    function expectEphemeral(interaction: unknown) {
        expectEphemeralReply(interaction);
    }

    it('removes user\'s own birthday', async () => {
        // Create a mock for removeBirthday
        const removeBirthdaySpy = vi.fn().mockResolvedValue(true);

        // Setup the test environment
        const { command, interaction } = await setupRemoveBirthdayCmd({
            interaction: {
                user: { id: '123456789012345678' },
                guildId: '135381928284343204'
            },
            managerOverrides: {
                birthdayManager: {
                    removeBirthday: removeBirthdaySpy
                }
            }
        });

        // Execute the command
        await command.execute(interaction as unknown as CommandInteraction);

        // Verify removeBirthday was called with correct parameters
        expect(removeBirthdaySpy).toHaveBeenCalledWith('123456789012345678', '135381928284343204');

        // Verify the interaction reply (content and ephemeral)
        expectReplyContains(interaction, 'Your birthday has been removed');
        expectEphemeral(interaction);
    });

    it('allows admin to remove another user\'s birthday', async () => {
        const { requireAdmin } = await import('../../../utils/permissions.js');
        vi.mocked(requireAdmin).mockResolvedValue(true);

        // Target user ID
        const targetUserId = '234567890123456789';

        // Create mocks
        const removeBirthdaySpy = vi.fn().mockResolvedValue(true);

        // Setup the test environment with target user option
        const { command, interaction } = await setupRemoveBirthdayCmd({
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
        });

        // Execute the command
        await command.execute(interaction as unknown as CommandInteraction);

        // Verify requireAdmin was called
        expect(requireAdmin).toHaveBeenCalledWith(interaction);

        // Verify removeBirthday was called with the target user's ID
        expect(removeBirthdaySpy).toHaveBeenCalledWith(targetUserId, '135381928284343204');

        // Verify the interaction reply mentions the target user and is ephemeral
        expectReplyContains(interaction, `<@${targetUserId}>'s birthday has been removed`);
        expectEphemeral(interaction);
    });

    it('prevents non-admin from removing another user\'s birthday', async () => {
        const { requireAdmin } = await import('../../../utils/permissions.js');
        vi.mocked(requireAdmin).mockResolvedValue(false);

        // Target user ID
        const targetUserId = '234567890123456789';

        // Create mocks
        const removeBirthdaySpy = vi.fn().mockResolvedValue(true);

        // Setup the test environment with target user option
        const { command, interaction } = await setupRemoveBirthdayCmd({
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
        });

        // Execute the command
        await command.execute(interaction as unknown as CommandInteraction);

        // Verify requireAdmin was called
        expect(requireAdmin).toHaveBeenCalledWith(interaction);

        // Verify removeBirthday was NOT called
        expect(removeBirthdaySpy).not.toHaveBeenCalled();
    });
});
