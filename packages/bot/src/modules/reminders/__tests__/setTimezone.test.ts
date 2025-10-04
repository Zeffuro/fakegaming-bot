// filepath: f:\Coding\discord-bot\packages\bot\src\modules\reminders\__tests__\setTimezone.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { setupCommandTest } from '@zeffuro/fakegaming-common/testing';
import { ChatInputCommandInteraction, AutocompleteInteraction } from 'discord.js';

// Mock the timezoneUtils module
vi.mock('../../../utils/timezoneUtils.js', () => {
    return {
        isValidTimezone: vi.fn().mockImplementation((timezone) => {
            // Mock implementation for testing
            if (timezone === 'Europe/Berlin' || timezone === 'America/New_York') return true;
            if (timezone === 'GMT+2') return true;
            return false;
        }),
        getTimezoneSuggestions: vi.fn().mockImplementation((query) => {
            // Mock implementation for testing
            if (query === 'europe') return ['Europe/Berlin', 'Europe/London', 'Europe/Paris'];
            if (query === 'america') return ['America/New_York', 'America/Chicago', 'America/Los_Angeles'];
            return [];
        })
    };
});

describe('setTimezone command', () => {
    beforeEach(() => {
        // Reset all mocks and clear module cache before each test
        vi.resetAllMocks();
        vi.resetModules();
    });

    it('sets a valid timezone for the user', async () => {
        // Create mock for userManager's setTimezone method
        const setTimezoneSpy = vi.fn().mockResolvedValue({
            discordId: '123456789012345678',
            timezone: 'Europe/Berlin'
        });

        // Mock user
        const mockUser = {
            id: '123456789012345678',
            tag: 'testUser#1234'
        };

        // Setup the test environment
        const { command, interaction } = await setupCommandTest(
            'modules/reminders/commands/setTimezone.js',
            {
                interaction: {
                    options: {
                        getString: vi.fn().mockImplementation(name => {
                            if (name === 'timezone') return 'Europe/Berlin';
                            return null;
                        })
                    },
                    user: mockUser
                },
                managerOverrides: {
                    userManager: {
                        setTimezone: setTimezoneSpy
                    }
                }
            }
        );

        // Execute the command
        await command.execute(interaction as unknown as ChatInputCommandInteraction);

        // Verify userManager's setTimezone method was called with the correct parameters
        expect(setTimezoneSpy).toHaveBeenCalledWith({
            discordId: '123456789012345678',
            timezone: 'Europe/Berlin'
        });

        // Verify the interaction reply
        expect(interaction.reply).toHaveBeenCalledWith(
            'Timezone set to `Europe/Berlin`.'
        );
    });

    it('handles invalid timezone format', async () => {
        // Mock user
        const mockUser = {
            id: '123456789012345678',
            tag: 'testUser#1234'
        };

        // Setup the test environment with a spy for setTimezone
        const setTimezoneSpy = vi.fn();
        const { command, interaction } = await setupCommandTest(
            'modules/reminders/commands/setTimezone.js',
            {
                interaction: {
                    options: {
                        getString: vi.fn().mockReturnValue('InvalidTimezone')
                    },
                    user: mockUser
                },
                managerOverrides: {
                    userManager: {
                        setTimezone: setTimezoneSpy
                    }
                }
            }
        );

        // Execute the command
        await command.execute(interaction as unknown as ChatInputCommandInteraction);

        // Verify the interaction reply for error
        expect(interaction.reply).toHaveBeenCalledWith(
            'Invalid timezone. Please use a valid IANA timezone (e.g., Europe/Berlin) or GMT offset.'
        );

        // Verify that the setTimezone method was not called
        expect(setTimezoneSpy).not.toHaveBeenCalled();
    });

    it('returns timezone suggestions for autocomplete', async () => {
        const { getTimezoneSuggestions } = await import('../../../utils/timezoneUtils.js');

        // Setup mock response for getTimezoneSuggestions
        vi.mocked(getTimezoneSuggestions).mockReturnValue(['Europe/Berlin', 'Europe/London', 'Europe/Paris']);

        // Create mock for autocomplete interaction
        const mockInteraction = {
            options: {
                getFocused: vi.fn().mockReturnValue('europe')
            },
            respond: vi.fn().mockResolvedValue(undefined)
        };

        // Setup the test environment
        const { command } = await setupCommandTest(
            'modules/reminders/commands/setTimezone.js',
            {}
        );

        // Execute the autocomplete function
        await command.autocomplete(mockInteraction as unknown as AutocompleteInteraction);

        // Verify respond was called with suggestions
        expect(mockInteraction.respond).toHaveBeenCalledWith([
            { name: 'Europe/Berlin', value: 'Europe/Berlin' },
            { name: 'Europe/London', value: 'Europe/London' },
            { name: 'Europe/Paris', value: 'Europe/Paris' }
        ]);
    });
});
