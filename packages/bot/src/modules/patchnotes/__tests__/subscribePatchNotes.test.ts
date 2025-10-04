import { describe, it, expect, vi, beforeEach, MockedFunction } from 'vitest';
import { setupCommandTest } from '@zeffuro/fakegaming-common/testing';
import { ChatInputCommandInteraction } from 'discord.js';
// Import the type only to satisfy ESLint
import type { MessageFlags } from 'discord.js';

// Dummy type usage to satisfy ESLint
type _TestType = MessageFlags;

// Mock the patch note embed builder
vi.mock('../shared/patchNoteEmbed.js', () => ({
    buildPatchNoteEmbed: vi.fn().mockReturnValue({ /* mock embed */ })
}));

// Mock the permissions utility
vi.mock('../../../utils/permissions.js', () => ({
    requireAdmin: vi.fn()
}));

// Import mocked functions after mocking
import { buildPatchNoteEmbed } from '../shared/patchNoteEmbed.js';
import { requireAdmin } from '../../../utils/permissions.js';

// Add Mock type definition
type Mock = MockedFunction<typeof requireAdmin>;

describe('subscribePatchNotes command', () => {
    beforeEach(() => {
        // Reset all mocks and clear module cache before each test
        vi.resetAllMocks();
        vi.resetModules();
    });

    it('subscribes a channel to patch notes and shows latest patch when available', async () => {
        // Mock the requireAdmin function to return true (user is admin)
        (requireAdmin as Mock).mockResolvedValue(true);

        // Create mock patch notes data
        const mockPatchNote = {
            game: 'LeagueOfLegends',
            title: 'Patch 11.23',
            content: 'Test patch content',
            url: 'https://example.com/patch-notes',
            date: new Date()
        };

        // Create spy for subscription manager
        const subscribeSpy = vi.fn().mockResolvedValue({ id: 'sub123' });

        // Create spy for patch notes manager
        const getLatestPatchSpy = vi.fn().mockResolvedValue(mockPatchNote);

        // Setup mock channel
        const mockChannel = {
            id: '929533532185956352',
            type: 0, // TextChannel
            name: 'test-channel'
        };

        // Setup the test environment
        const { command, interaction } = await setupCommandTest(
            'modules/patchnotes/commands/subscribePatchNotes.js',
            {
                interaction: {
                    options: {
                        getString: vi.fn().mockReturnValue('LeagueOfLegends'),
                        getChannel: vi.fn().mockReturnValue(mockChannel)
                    },
                    guildId: '135381928284343204'
                },
                managerOverrides: {
                    patchSubscriptionManager: {
                        subscribe: subscribeSpy
                    },
                    patchNotesManager: {
                        getLatestPatch: getLatestPatchSpy
                    }
                }
            }
        );

        // Execute the command
        await command.execute(interaction as unknown as ChatInputCommandInteraction);

        // Verify requireAdmin was called
        expect(requireAdmin).toHaveBeenCalledWith(interaction);

        // Verify subscribe was called with the correct parameters
        expect(subscribeSpy).toHaveBeenCalledWith(
            'LeagueOfLegends',
            '929533532185956352',
            '135381928284343204'
        );

        // Verify getLatestPatch was called with the correct game
        expect(getLatestPatchSpy).toHaveBeenCalledWith('LeagueOfLegends');

        // Verify buildPatchNoteEmbed was called with the patch data
        expect(buildPatchNoteEmbed).toHaveBeenCalledWith(mockPatchNote);

        // Verify interaction.reply was called

        // Verify the interaction reply includes content and embeds
        const replyCall = (interaction.reply as any).mock.calls[0][0];
        expect(replyCall).toHaveProperty('content');
        expect(replyCall.content).toContain(`Subscribed <#${mockChannel.id}> to patch notes for \`LeagueOfLegends\``);
        expect(replyCall).toHaveProperty('embeds');
        expect(Array.isArray(replyCall.embeds)).toBe(true);
    });

    it('subscribes a channel to patch notes without showing latest patch when not available', async () => {
        // Mock the requireAdmin function to return true (user is admin)
        (requireAdmin as Mock).mockResolvedValue(true);

        // Create spy for subscription manager
        const subscribeSpy = vi.fn().mockResolvedValue({ id: 'sub123' });

        // Create spy for patch notes manager - no patch notes available
        const getLatestPatchSpy = vi.fn().mockResolvedValue(null);

        // Setup mock channel
        const mockChannel = {
            id: '929533532185956352',
            type: 0, // TextChannel
            name: 'test-channel'
        };

        // Setup the test environment
        const { command, interaction } = await setupCommandTest(
            'modules/patchnotes/commands/subscribePatchNotes.js',
            {
                interaction: {
                    options: {
                        getString: vi.fn().mockReturnValue('Valorant'),
                        getChannel: vi.fn().mockReturnValue(mockChannel)
                    },
                    guildId: '135381928284343204'
                },
                managerOverrides: {
                    patchSubscriptionManager: {
                        subscribe: subscribeSpy
                    },
                    patchNotesManager: {
                        getLatestPatch: getLatestPatchSpy
                    }
                }
            }
        );

        // Execute the command
        await command.execute(interaction as unknown as ChatInputCommandInteraction);

        // Verify subscribe was called with the correct parameters
        expect(subscribeSpy).toHaveBeenCalledWith(
            'Valorant',
            '929533532185956352',
            '135381928284343204'
        );

        // Verify the interaction reply includes only the success message (no embed)
        expect(interaction.reply).toHaveBeenCalledWith(
            `Subscribed <#${mockChannel.id}> to patch notes for \`Valorant\`.`
        );

        // Verify buildPatchNoteEmbed was NOT called
        expect(buildPatchNoteEmbed).not.toHaveBeenCalled();
    });

    it('prevents non-admin users from subscribing channels', async () => {
        // Mock the requireAdmin function to return false (user is not admin)
        (requireAdmin as Mock).mockResolvedValue(false);

        // Create spies that should NOT be called
        const subscribeSpy = vi.fn();
        const getLatestPatchSpy = vi.fn();

        // Setup the test environment
        const { command, interaction } = await setupCommandTest(
            'modules/patchnotes/commands/subscribePatchNotes.js',
            {
                interaction: {
                    options: {
                        getString: vi.fn().mockReturnValue('LeagueOfLegends'),
                        getChannel: vi.fn().mockReturnValue({ id: '929533532185956352' })
                    },
                    guildId: '135381928284343204'
                },
                managerOverrides: {
                    patchSubscriptionManager: {
                        subscribe: subscribeSpy
                    },
                    patchNotesManager: {
                        getLatestPatch: getLatestPatchSpy
                    }
                }
            }
        );

        // Execute the command
        await command.execute(interaction as unknown as ChatInputCommandInteraction);

        // Verify requireAdmin was called
        expect(requireAdmin).toHaveBeenCalledWith(interaction);

        // Verify that none of the manager functions were called
        expect(subscribeSpy).not.toHaveBeenCalled();
        expect(getLatestPatchSpy).not.toHaveBeenCalled();

        // Verify the interaction reply was NOT called
        expect(interaction.reply).not.toHaveBeenCalled();
    });

    // Test for autocomplete function
    it('calls gameAutocomplete for autocomplete interaction', async () => {
        // Mock the gameAutocomplete function
        vi.mock('../shared/gameAutocomplete.js', () => ({
            gameAutocomplete: vi.fn()
        }));

        // Import after mocking
        const { gameAutocomplete } = await import('../shared/gameAutocomplete.js');

        // Setup the test environment
        const { command } = await setupCommandTest(
            'modules/patchnotes/commands/subscribePatchNotes.js',
            {}
        );

        // Mock autocomplete interaction
        const mockAutocompleteInteraction = { /* minimal mock */ };

        // Call the autocomplete function
        await command.autocomplete(mockAutocompleteInteraction as any);

        // Verify gameAutocomplete was called with the interaction
        expect(gameAutocomplete).toHaveBeenCalledWith(mockAutocompleteInteraction);
    });
});
