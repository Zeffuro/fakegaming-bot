import { describe, it, expect, vi, beforeEach } from 'vitest';
import { setupCommandTest, createMockBirthday, expectReplyTextContains, expectEphemeralReply } from '@zeffuro/fakegaming-common/testing';
import { CommandInteraction } from 'discord.js';

describe('setBirthday command', () => {
    beforeEach(() => {
        // Reset all mocks and clear module cache before each test
        vi.resetAllMocks();
        vi.resetModules();
    });

    // Local helpers to reduce repetition
    async function setupSetBirthdayCmd(overrides?: Record<string, unknown>) {
        return setupCommandTest(
            'modules/birthdays/commands/setBirthday.js',
            overrides ?? {}
        );
    }

    function expectReplyContains(interaction: unknown, substr: string) {
        expectReplyTextContains(interaction, substr);
    }

    function expectEphemeral(interaction: unknown) {
        expectEphemeralReply(interaction);
    }

    it('sets a birthday for a user', async () => {
        // 1. Create the mock spy function with its return value directly.
        const addSpy = vi.fn().mockResolvedValue(
            createMockBirthday({
                day: 5,
                month: 1,
                year: 1990,
                userId: '123456789012345678',
                guildId: '135381928284343204',
                channelId: '929533532185956352'
            })
        );

        // Create hasBirthday spy to return false (so the command proceeds)
        const hasBirthdaySpy = vi.fn().mockResolvedValue(false);

        // 2. Setup the test environment and pass the direct spy reference via managerOverrides
        const { command, interaction } = await setupSetBirthdayCmd({
            interaction: {
                stringOptions: {
                    month: 'January'
                },
                integerOptions: {
                    day: 5,
                    year: 1990
                },
                user: { id: '123456789012345678' },
                guildId: '135381928284343204',
                channelId: '929533532185956352'
            },
            managerOverrides: {
                birthdayManager: {
                    add: addSpy,
                    hasBirthday: hasBirthdaySpy
                }
            }
        });

        // 3. Execute the command
        await command.execute(interaction as unknown as CommandInteraction);

        // 4. Verify the birthdayManager.hasBirthday was called first
        expect(hasBirthdaySpy).toHaveBeenCalledWith('123456789012345678', '135381928284343204');

        // 5. Verify the birthdayManager.add was called with correct parameters
        expect(addSpy).toHaveBeenCalledWith(
            expect.objectContaining({
                day: 5,
                month: 1,
                year: 1990,
                userId: '123456789012345678',
                guildId: '135381928284343204',
                channelId: '929533532185956352'
            })
        );

        // Verify the interaction reply (content and ephemeral)
        expectReplyContains(interaction, 'birthday reminder is set');
        expectEphemeral(interaction);
    });

    it('replies with error for invalid date', async () => {
        // Setup the test with invalid date parameters
        const { command, interaction } = await setupSetBirthdayCmd({
            interaction: {
                stringOptions: {
                    month: 'February'
                },
                integerOptions: {
                    day: 31,
                    year: 1990
                },
                user: { id: '123456789012345678' },
                guildId: '135381928284343204'
            }
        });

        // Execute the command
        await command.execute(interaction as unknown as CommandInteraction);

        // Verify error message was sent (content and ephemeral)
        expectReplyContains(interaction, 'Invalid');
        expectEphemeral(interaction);
    });

    it('replies with error when birthday already set', async () => {
        // Create hasBirthday spy to return true (birthday already exists)
        const hasBirthdaySpy = vi.fn().mockResolvedValue(true);
        const addSpy = vi.fn(); // Should not be called

        const { command, interaction } = await setupSetBirthdayCmd({
            interaction: {
                stringOptions: {
                    month: 'January'
                },
                integerOptions: {
                    day: 5,
                    year: 1990
                },
                user: { id: '123456789012345678' },
                guildId: '135381928284343204',
                channelId: '929533532185956352'
            },
            managerOverrides: {
                birthdayManager: {
                    add: addSpy,
                    hasBirthday: hasBirthdaySpy
                }
            }
        });

        await command.execute(interaction as unknown as CommandInteraction);

        // Verify hasBirthday was called
        expect(hasBirthdaySpy).toHaveBeenCalled();

        // Verify add was NOT called
        expect(addSpy).not.toHaveBeenCalled();

        // Verify error message was sent (content and ephemeral)
        expectReplyContains(interaction, 'already have a birthday set');
        expectEphemeral(interaction);
    });
});