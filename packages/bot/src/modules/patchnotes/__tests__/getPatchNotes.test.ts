import { describe, it, expect, vi, beforeEach, Mock } from 'vitest';
import { setupCommandTest, expectReplyText, expectReplyHasEmbedsArray } from '@zeffuro/fakegaming-common/testing';
import { ChatInputCommandInteraction, EmbedBuilder } from 'discord.js';
import { buildPatchNoteEmbed } from '../shared/patchNoteEmbed.js';

// Mock the API client used by the command
vi.mock('../../../utils/apiClient.js', () => ({
    fetchLatestPatchNoteApi: vi.fn()
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

    it('fetches patch notes from API when not available in the database', async () => {
        // Mock the database to return null (no patch notes available)
        const getLatestPatchSpy = vi.fn().mockResolvedValue(null);

        // Mock the API to return a patch note
        const mockFetchedPatchNote = {
            game: 'Valorant',
            title: 'Valorant Patch 3.10',
            content: 'Freshly fetched patch content',
            url: 'https://example.com/valorant-patch',
            publishedAt: new Date()
        };

        const { fetchLatestPatchNoteApi } = await import('../../../utils/apiClient.js');
        (fetchLatestPatchNoteApi as Mock).mockResolvedValue(mockFetchedPatchNote);

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

        // Verify the API was called
        expect(fetchLatestPatchNoteApi).toHaveBeenCalledWith('Valorant');

        // Verify buildPatchNoteEmbed was called with the fetched patch data
        expect(buildPatchNoteEmbed).toHaveBeenCalledWith(mockFetchedPatchNote);

        // Verify interaction.reply was called with an embed
        assertEmbedReply(interaction);
    });

    it('reports when no patch notes are found for the game', async () => {
        // Mock the database to return null (no patch notes available)
        const getLatestPatchSpy = vi.fn().mockResolvedValue(null);

        // Mock the API to return null (no patch notes found)
        const { fetchLatestPatchNoteApi } = await import('../../../utils/apiClient.js');
        (fetchLatestPatchNoteApi as Mock).mockResolvedValue(null);

        // Setup the test environment with a game that returns no patch notes
        const { command, interaction } = await setupWithManagerOverride({
            cmd: 'modules/patchnotes/commands/getPatchNotes.js',
            game: 'Fortnite',
            getLatestPatchSpy,
        });

        // Execute the command
        await command.execute(interaction as unknown as ChatInputCommandInteraction);

        // Verify getLatestPatch was called with the correct game
        expect(getLatestPatchSpy).toHaveBeenCalledWith('Fortnite');

        // Verify the API was called
        expect(fetchLatestPatchNoteApi).toHaveBeenCalledWith('Fortnite');

        // Verify the interaction reply contains the not found message
        assertTextReply(interaction, 'No patch notes found for `Fortnite`.');
    });

    // Test for autocomplete function
    it('calls gameAutocomplete for autocomplete interaction', async () => {
        const { runAutocompleteSmokeTest } = await import('../shared/__tests__/helpers/patchnotesTestHelpers.js');
        await runAutocompleteSmokeTest('modules/patchnotes/commands/getPatchNotes.js', '');
    });
});
