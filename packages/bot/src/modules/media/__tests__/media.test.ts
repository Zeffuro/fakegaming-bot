import type { AutocompleteInteraction, ChatInputCommandInteraction } from 'discord.js';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
    createMockAutocompleteInteraction,
    expectEphemeralReply,
    expectReplyHasEmbed,
    setupCommandTest,
} from '@zeffuro/fakegaming-common/testing';
import type { TmdbMedia } from '../../../services/tmdbService.js';

vi.mock('../../../services/tmdbService.js', async importOriginal => {
    const actual = await importOriginal<typeof import('../../../services/tmdbService.js')>();
    return {
        ...actual,
        getTmdbMedia: vi.fn(),
        searchTmdbMedia: vi.fn(),
    };
});

const dune: TmdbMedia = {
    id: 438631,
    type: 'movie',
    title: 'Dune',
    originalTitle: null,
    overview: 'A desert epic.',
    releaseDate: '2021-09-15',
    originalLanguage: 'en',
    posterPath: '/poster.jpg',
    backdropPath: '/backdrop.jpg',
    voteAverage: 7.8,
    voteCount: 12_000,
    popularity: 100,
    runtimeMinutes: 155,
    seasonCount: null,
    episodeCount: null,
    status: 'Released',
    genres: ['Science Fiction', 'Adventure'],
};

async function getMocks() {
    const service = await import('../../../services/tmdbService.js');
    return {
        getTmdbMedia: vi.mocked(service.getTmdbMedia),
        searchTmdbMedia: vi.mocked(service.searchTmdbMedia),
    };
}

async function setupMediaCommand(query: string, type = 'all', locale: 'en' | 'nl' = 'en') {
    return setupCommandTest('modules/media/commands/media.js', {
        interaction: {
            commandName: 'media',
            subcommand: 'search',
            stringOptions: { query, type },
        },
        managerOverrides: {
            guildLocaleConfigManager: { getOutputLocale: vi.fn().mockResolvedValue(locale) },
        },
    });
}

describe('media command', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('renders lookup results without persistence', async () => {
        const { searchTmdbMedia } = await getMocks();
        searchTmdbMedia.mockResolvedValue([dune]);
        const { command, interaction } = await setupMediaCommand('Dune', 'movie');

        await command.execute(interaction as ChatInputCommandInteraction);

        expect(searchTmdbMedia).toHaveBeenCalledWith('Dune', 'movie', 'en');
        expectReplyHasEmbed(interaction, { titleEquals: 'Movie and TV search: Dune', descriptionContains: 'Dune' });
    });

    it('renders an exact autocomplete selection in Dutch', async () => {
        const { getTmdbMedia } = await getMocks();
        getTmdbMedia.mockResolvedValue(dune);
        const { command, interaction } = await setupMediaCommand('tmdb:movie:438631', 'all', 'nl');

        await command.execute(interaction as ChatInputCommandInteraction);

        expect(getTmdbMedia).toHaveBeenCalledWith('movie', 438631, 'nl');
        expectReplyHasEmbed(interaction, { titleEquals: 'Dune', field: { nameEquals: 'Speelduur', valueEquals: '155 min.' } });
        const payload = vi.mocked(interaction.reply).mock.calls[0]?.[0] as { embeds?: Array<{ toJSON(): unknown }> };
        expect(payload.embeds?.[0]?.toJSON()).toMatchObject({
            footer: { text: expect.stringContaining('TMDB API') },
            thumbnail: { url: 'https://image.tmdb.org/t/p/w500/poster.jpg' },
        });
    });

    it('returns an ephemeral configuration message when no token is installed', async () => {
        const service = await import('../../../services/tmdbService.js');
        const { searchTmdbMedia } = await getMocks();
        searchTmdbMedia.mockRejectedValue(new service.TmdbConfigurationError());
        const { command, interaction } = await setupMediaCommand('Dune');

        await command.execute(interaction as ChatInputCommandInteraction);

        expectEphemeralReply(interaction, { equals: 'Movie and TV search is not configured on this bot.' });
    });

    it('reports rejected credentials separately from provider outages', async () => {
        const service = await import('../../../services/tmdbService.js');
        const { searchTmdbMedia } = await getMocks();
        searchTmdbMedia.mockRejectedValue(new service.TmdbAuthenticationError(401));
        const { command, interaction } = await setupMediaCommand('Dune');

        await command.execute(interaction as ChatInputCommandInteraction);

        expectEphemeralReply(interaction, {
            equals: 'TMDB rejected the configured credentials. Check the API Read Access Token or API key and restart the bot.',
        });
    });

    it('autocompletes stable provider IDs', async () => {
        const { searchTmdbMedia } = await getMocks();
        searchTmdbMedia.mockResolvedValue([dune]);
        const { command } = await setupMediaCommand('Dune');
        const interaction = createMockAutocompleteInteraction({
            focused: 'Dun',
            options: {
                getFocused: vi.fn(() => 'Dun'),
                getString: vi.fn(() => 'all'),
            },
        });

        await command.autocomplete(interaction as AutocompleteInteraction);

        expect(interaction.respond).toHaveBeenCalledWith([
            { name: 'Dune (Movie - 2021)', value: 'tmdb:movie:438631' },
        ]);
    });
});
