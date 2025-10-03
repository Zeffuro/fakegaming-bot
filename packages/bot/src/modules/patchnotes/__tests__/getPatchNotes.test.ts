import { describe, it, expect, vi, beforeEach, Mock } from 'vitest';
import { setupCommandTest } from '@zeffuro/fakegaming-common/testing';
import { ChatInputCommandInteraction, EmbedBuilder } from 'discord.js';
import { loadPatchNoteFetchers } from '../../../loaders/loadPatchNoteFetchers.js';
import { buildPatchNoteEmbed } from '../shared/patchNoteEmbed.js';

// Mock the loadPatchNoteFetchers module
vi.mock('../../../loaders/loadPatchNoteFetchers.js', () => ({
    loadPatchNoteFetchers: vi.fn()
}));

// Mock the buildPatchNoteEmbed function
vi.mock('../shared/patchNoteEmbed.js', () => ({
    buildPatchNoteEmbed: vi.fn().mockImplementation(() => {
        return new EmbedBuilder();
    })
}));

describe('getPatchNotes command', () => {
    beforeEach(() => {
        // Reset all mocks and clear module cache before each test
        vi.resetAllMocks();
        vi.resetModules();
    });

    it('retrieves patch notes from the database when available', async () => {
        // Create mock patch notes data
        const mockPatchNote = {
            game: 'LeagueOfLegends',
            title: 'Patch 11.23',
            content: 'Test patch content',
            url: 'https://example.com/patch-notes',
            date: new Date()
        };

        // Create a spy for the getLatestPatch method
        const getLatestPatchSpy = vi.fn().mockResolvedValue(mockPatchNote);

        // Setup the test environment
        const { command, interaction } = await setupCommandTest(
            'modules/patchnotes/commands/getPatchNotes.js',
            {
                interaction: {
                    options: {
                        getString: vi.fn().mockReturnValue('LeagueOfLegends')
                    }
                },
                managerOverrides: {
                    patchNotesManager: {
                        getLatestPatch: getLatestPatchSpy
                    }
                }
            }
        );

        // Execute the command
        await command.execute(interaction as unknown as ChatInputCommandInteraction);

        // Verify getLatestPatch was called with the correct game
        expect(getLatestPatchSpy).toHaveBeenCalledWith('LeagueOfLegends');

        // Verify buildPatchNoteEmbed was called with the patch data
        expect(buildPatchNoteEmbed).toHaveBeenCalledWith(mockPatchNote);

        // Verify interaction.reply was called
        expect(interaction.reply).toHaveBeenCalled();

        // Verify the interaction reply includes an embeds array
        const replyCall = (interaction.reply as any).mock.calls[0][0];
        expect(replyCall).toHaveProperty('embeds');
        expect(Array.isArray(replyCall.embeds)).toBe(true);
    });

    it('fetches patch notes from fetcher when not available in the database', async () => {
        // Mock the database to return null (no patch notes available)
        const getLatestPatchSpy = vi.fn().mockResolvedValue(null);

        // Create mock patch note from fetcher
        const mockFetchedPatchNote = {
            game: 'Valorant',
            title: 'Valorant Patch 3.10',
            content: 'Freshly fetched patch content',
            url: 'https://example.com/valorant-patch',
            date: new Date()
        };

        // Mock the fetcher
        const mockFetcher = {
            game: 'Valorant',
            fetchLatestPatchNote: vi.fn().mockResolvedValue(mockFetchedPatchNote)
        };

        // Mock loadPatchNoteFetchers to return our mock fetcher
        (loadPatchNoteFetchers as Mock).mockResolvedValue([mockFetcher]);

        // Setup the test environment
        const { command, interaction } = await setupCommandTest(
            'modules/patchnotes/commands/getPatchNotes.js',
            {
                interaction: {
                    options: {
                        getString: vi.fn().mockReturnValue('Valorant')
                    }
                },
                managerOverrides: {
                    patchNotesManager: {
                        getLatestPatch: getLatestPatchSpy
                    }
                }
            }
        );

        // Execute the command
        await command.execute(interaction as unknown as ChatInputCommandInteraction);

        // Verify getLatestPatch was called with the correct game
        expect(getLatestPatchSpy).toHaveBeenCalledWith('Valorant');

        // Verify loadPatchNoteFetchers was called
        expect(loadPatchNoteFetchers).toHaveBeenCalled();

        // Verify the fetcher was called
        expect(mockFetcher.fetchLatestPatchNote).toHaveBeenCalled();

        // Verify buildPatchNoteEmbed was called with the fetched patch data
        expect(buildPatchNoteEmbed).toHaveBeenCalledWith(mockFetchedPatchNote);

        // Verify interaction.reply was called
        expect(interaction.reply).toHaveBeenCalled();

        // Verify the interaction reply includes an embeds array
        const replyCall = (interaction.reply as any).mock.calls[0][0];
        expect(replyCall).toHaveProperty('embeds');
        expect(Array.isArray(replyCall.embeds)).toBe(true);
    });

    it('reports when no fetcher is found for the game', async () => {
        // Mock the database to return null (no patch notes available)
        const getLatestPatchSpy = vi.fn().mockResolvedValue(null);

        // Mock loadPatchNoteFetchers to return fetchers for other games only
        (loadPatchNoteFetchers as Mock).mockResolvedValue([
            { game: 'LeagueOfLegends', fetchLatestPatchNote: vi.fn() },
            { game: 'Valorant', fetchLatestPatchNote: vi.fn() }
        ]);

        // Setup the test environment with a game that has no fetcher
        const { command, interaction } = await setupCommandTest(
            'modules/patchnotes/commands/getPatchNotes.js',
            {
                interaction: {
                    options: {
                        getString: vi.fn().mockReturnValue('Fortnite')
                    }
                },
                managerOverrides: {
                    patchNotesManager: {
                        getLatestPatch: getLatestPatchSpy
                    }
                }
            }
        );

        // Execute the command
        await command.execute(interaction as unknown as ChatInputCommandInteraction);

        // Verify getLatestPatch was called with the correct game
        expect(getLatestPatchSpy).toHaveBeenCalledWith('Fortnite');

        // Verify loadPatchNoteFetchers was called
        expect(loadPatchNoteFetchers).toHaveBeenCalled();

        // Verify the interaction reply contains the error message
        expect(interaction.reply).toHaveBeenCalledWith(
            expect.stringContaining('No patch notes fetcher found for `Fortnite`')
        );
    });

    it('reports when no patch notes are found by the fetcher', async () => {
        // Mock the database to return null (no patch notes available)
        const getLatestPatchSpy = vi.fn().mockResolvedValue(null);

        // Mock the fetcher to return null (no patch notes found)
        const mockFetcher = {
            game: 'Overwatch',
            fetchLatestPatchNote: vi.fn().mockResolvedValue(null)
        };

        // Mock loadPatchNoteFetchers to return our mock fetcher
        (loadPatchNoteFetchers as Mock).mockResolvedValue([mockFetcher]);

        // Setup the test environment
        const { command, interaction } = await setupCommandTest(
            'modules/patchnotes/commands/getPatchNotes.js',
            {
                interaction: {
                    options: {
                        getString: vi.fn().mockReturnValue('Overwatch')
                    }
                },
                managerOverrides: {
                    patchNotesManager: {
                        getLatestPatch: getLatestPatchSpy
                    }
                }
            }
        );

        // Execute the command
        await command.execute(interaction as unknown as ChatInputCommandInteraction);

        // Verify the fetcher was called
        expect(mockFetcher.fetchLatestPatchNote).toHaveBeenCalled();

        // Verify the interaction reply contains the error message
        expect(interaction.reply).toHaveBeenCalledWith(
            expect.stringContaining('No patch notes found for `Overwatch`')
        );
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
            'modules/patchnotes/commands/getPatchNotes.js',
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
