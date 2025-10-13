import { describe, it, expect, vi, beforeEach, Mock } from 'vitest';
import { setupCommandTest, expectReplyText, expectReplyHasEmbedsArray } from '@zeffuro/fakegaming-common/testing';
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

// --- local helpers (DRY) ---
const assertEmbedReply = (interaction: any) => {
    expectReplyHasEmbedsArray(interaction);
};

async function setupWithManagerOverride(opts: {
    cmd: string;
    game: string;
    getLatestPatchSpy: ReturnType<typeof vi.fn>;
}) {
    const { cmd, game, getLatestPatchSpy } = opts;
    return setupCommandTest(cmd, {
        interaction: { stringOptions: { game } },
        managerOverrides: { patchNotesManager: { getLatestPatch: getLatestPatchSpy } },
    });
}

const assertTextReply = (interaction: any, text: string) => {
    expectReplyText(interaction, text);
};

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
        const { command, interaction } = await setupWithManagerOverride({
            cmd: 'modules/patchnotes/commands/getPatchNotes.js',
            game: 'LeagueOfLegends',
            getLatestPatchSpy,
        });

        // Execute the command
        await command.execute(interaction as unknown as ChatInputCommandInteraction);

        // Verify getLatestPatch was called with the correct game
        expect(getLatestPatchSpy).toHaveBeenCalledWith('LeagueOfLegends');

        // Verify buildPatchNoteEmbed was called with the patch data
        expect(buildPatchNoteEmbed).toHaveBeenCalledWith(mockPatchNote);

        // Verify interaction.reply was called with an embed
        assertEmbedReply(interaction);
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
        const { command, interaction } = await setupWithManagerOverride({
            cmd: 'modules/patchnotes/commands/getPatchNotes.js',
            game: 'Valorant',
            getLatestPatchSpy,
        });

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

        // Verify interaction.reply was called with an embed
        assertEmbedReply(interaction);
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
        const { command, interaction } = await setupWithManagerOverride({
            cmd: 'modules/patchnotes/commands/getPatchNotes.js',
            game: 'Fortnite',
            getLatestPatchSpy,
        });

        // Execute the command
        await command.execute(interaction as unknown as ChatInputCommandInteraction);

        // Verify getLatestPatch was called with the correct game
        expect(getLatestPatchSpy).toHaveBeenCalledWith('Fortnite');

        // Verify loadPatchNoteFetchers was called
        expect(loadPatchNoteFetchers).toHaveBeenCalled();

        // Verify the interaction reply contains the error message
        assertTextReply(interaction, 'No patch notes fetcher found for `Fortnite`.');
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
        const { command, interaction } = await setupWithManagerOverride({
            cmd: 'modules/patchnotes/commands/getPatchNotes.js',
            game: 'Overwatch',
            getLatestPatchSpy,
        });

        // Execute the command
        await command.execute(interaction as unknown as ChatInputCommandInteraction);

        // Verify getLatestPatch was called with the correct game
        expect(getLatestPatchSpy).toHaveBeenCalledWith('Overwatch');

        // Verify loadPatchNoteFetchers was called
        expect(loadPatchNoteFetchers).toHaveBeenCalled();

        // Verify the interaction reply contains the error message
        assertTextReply(interaction, 'No patch notes found for `Overwatch`.');
    });

    // Test for autocomplete function
    it('calls gameAutocomplete for autocomplete interaction', async () => {
        const { runAutocompleteSmokeTest } = await import('../shared/__tests__/helpers/patchnotesTestHelpers.js');
        await runAutocompleteSmokeTest('modules/patchnotes/commands/getPatchNotes.js', '');
    });
});
