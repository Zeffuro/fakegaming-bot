import { describe, it, expect, vi, beforeEach } from 'vitest';
import { setupCommandTest, createMockBirthday, expectReplyTextContains, expectEphemeralReply } from '@zeffuro/fakegaming-common/testing';
import { CommandInteraction } from 'discord.js';

describe('birthday command', () => {
    beforeEach(() => {
        // Reset all mocks and clear module cache before each test
        vi.resetAllMocks();
        vi.resetModules();
    });

    // Local helpers
    async function setupBirthdayCmd(overrides?: Record<string, unknown>) {
        return setupCommandTest(
            'modules/birthdays/commands/birthday.js',
            overrides ?? {}
        );
    }

    function expectReplyContains(interaction: unknown, substr: string) {
        expectReplyTextContains(interaction, substr);
    }

    function expectEphemeral(interaction: unknown) {
        expectEphemeralReply(interaction);
    }

    it('shows a user their own birthday', async () => {
        // Create a mock birthday to be returned by the getBirthday method
        const mockBirthday = createMockBirthday({
            day: 5,
            month: 1, // January
            year: 1990,
            userId: '123456789012345678',
            guildId: '135381928284343204'
        });

        // Create getBirthday spy to return the mock birthday
        const getBirthdaySpy = vi.fn().mockResolvedValue(mockBirthday);

        // Setup the test environment with the mock
        const { command, interaction } = await setupBirthdayCmd({
            interaction: {
                user: { id: '123456789012345678' },
                guildId: '135381928284343204'
            },
            managerOverrides: {
                birthdayManager: {
                    getBirthday: getBirthdaySpy
                }
            }
        });

        // Execute the command
        await command.execute(interaction as unknown as CommandInteraction);

        // Verify getBirthday was called with correct parameters
        expect(getBirthdaySpy).toHaveBeenCalledWith('123456789012345678', '135381928284343204');

        // Verify the interaction reply (content and ephemeral)
        expectReplyContains(interaction, 'Your birthday: 5 January 1990');
        expectEphemeral(interaction);
    });

    it('shows another user\'s birthday when user option is provided', async () => {
        // Create a mock birthday for the target user
        const targetUserId = '234567890123456789';
        const mockBirthday = createMockBirthday({
            day: 15,
            month: 6, // June
            year: 1985,
            userId: targetUserId,
            guildId: '135381928284343204'
        });

        // Create getBirthday spy to return the mock birthday
        const getBirthdaySpy = vi.fn().mockResolvedValue(mockBirthday);

        // Setup the test environment with the user option
        const { command, interaction } = await setupBirthdayCmd({
            interaction: {
                user: { id: '123456789012345678' },
                guildId: '135381928284343204',
                options: {
                    getUser: vi.fn((name) => name === 'user' ? { id: targetUserId } : null)
                }
            },
            managerOverrides: {
                birthdayManager: {
                    getBirthday: getBirthdaySpy
                }
            }
        });

        // Execute the command
        await command.execute(interaction as unknown as CommandInteraction);

        // Verify getBirthday was called with the target user's ID
        expect(getBirthdaySpy).toHaveBeenCalledWith(targetUserId, '135381928284343204');

        // Verify the interaction reply (content and ephemeral)
        expectReplyContains(interaction, `<@${targetUserId}>'s birthday: 15 June 1985`);
        expectEphemeral(interaction);
    });

    it('shows appropriate message when user has no birthday set', async () => {
        // Create getBirthday spy to return null (no birthday set)
        const getBirthdaySpy = vi.fn().mockResolvedValue(null);

        // Setup the test environment
        const { command, interaction } = await setupBirthdayCmd({
            interaction: {
                user: { id: '123456789012345678' },
                guildId: '135381928284343204'
            },
            managerOverrides: {
                birthdayManager: {
                    getBirthday: getBirthdaySpy
                }
            }
        });

        // Execute the command
        await command.execute(interaction as unknown as CommandInteraction);

        // Verify getBirthday was called
        expect(getBirthdaySpy).toHaveBeenCalled();

        // Verify the interaction reply shows "not set" message (and ephemeral)
        expectReplyContains(interaction, 'You do not have a birthday set');
        expectEphemeral(interaction);
    });

    it('shows appropriate message when another user has no birthday set', async () => {
        // Target user ID
        const targetUserId = '234567890123456789';

        // Create getBirthday spy to return null (no birthday set)
        const getBirthdaySpy = vi.fn().mockResolvedValue(null);

        // Setup the test environment with target user option
        const { command, interaction } = await setupBirthdayCmd({
            interaction: {
                user: { id: '123456789012345678' },
                guildId: '135381928284343204',
                options: {
                    getUser: vi.fn((name) => name === 'user' ? { id: targetUserId } : null)
                }
            },
            managerOverrides: {
                birthdayManager: {
                    getBirthday: getBirthdaySpy
                }
            }
        });

        // Execute the command
        await command.execute(interaction as unknown as CommandInteraction);

        // Verify getBirthday was called with the target user's ID
        expect(getBirthdaySpy).toHaveBeenCalledWith(targetUserId, '135381928284343204');

        // Verify the interaction reply shows "not set" message for target user (and ephemeral)
        expectReplyContains(interaction, `<@${targetUserId}> do not have a birthday set`);
        expectEphemeral(interaction);
    });

    it('correctly handles birthdays without year', async () => {
        // Create a mock birthday without year
        const mockBirthday = createMockBirthday({
            day: 25,
            month: 12, // December
            year: undefined, // Changed from null to undefined to match the expected type
            userId: '123456789012345678',
            guildId: '135381928284343204'
        });

        // Create getBirthday spy to return the birthday without year
        const getBirthdaySpy = vi.fn().mockResolvedValue(mockBirthday);

        // Setup the test environment
        const { command, interaction } = await setupBirthdayCmd({
            interaction: {
                user: { id: '123456789012345678' },
                guildId: '135381928284343204'
            },
            managerOverrides: {
                birthdayManager: {
                    getBirthday: getBirthdaySpy
                }
            }
        });

        // Execute the command
        await command.execute(interaction as unknown as CommandInteraction);

        // Verify getBirthday was called
        expect(getBirthdaySpy).toHaveBeenCalled();

        // Verify the interaction reply shows the date without a year (and is ephemeral)
        expectReplyContains(interaction, 'Your birthday: 25 December');
        expectEphemeral(interaction);

        // Ensure the response doesn't include a stray 'null' year
        expect(interaction.reply).not.toHaveBeenCalledWith(
            expect.objectContaining({
                content: expect.stringContaining('December null'),
            })
        );
    });
});
