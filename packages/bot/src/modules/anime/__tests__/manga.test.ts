import { describe, expect, it, vi, beforeEach } from 'vitest';
import { AutocompleteInteraction, ChatInputCommandInteraction } from 'discord.js';
import {
    createMockAutocompleteInteraction,
    expectEphemeralReply,
    expectReplyHasEmbed,
    setupCommandTest,
} from '@zeffuro/fakegaming-common/testing';
import type { AniListTitle } from '@zeffuro/fakegaming-common/anime';

vi.mock('@zeffuro/fakegaming-common/anime', async (importOriginal) => {
    const actual = await importOriginal<typeof import('@zeffuro/fakegaming-common/anime')>();
    return {
        ...actual,
        getAniListMangaById: vi.fn(),
        mapAniListTitleToInput: vi.fn((title: AniListTitle) => ({ anilistId: title.id })),
        searchAniListManga: vi.fn(),
        searchAniListMedia: vi.fn(),
    };
});

const mangaResult: AniListTitle = {
    id: 30013,
    type: 'MANGA',
    title: {
        english: 'Solo Leveling',
        romaji: 'Na Honjaman Level Up',
    },
    description: 'A hunter gains a strange leveling power.',
    siteUrl: 'https://anilist.co/manga/30013/Solo-Leveling/',
    coverImage: { large: 'https://img.example/cover.jpg', color: '#02a9ff' },
    format: 'MANGA',
    status: 'FINISHED',
    countryOfOrigin: 'KR',
    chapters: 201,
    volumes: 14,
    averageScore: 82,
    genres: ['Action', 'Fantasy'],
};

async function getAnimeMocks() {
    const anime = await import('@zeffuro/fakegaming-common/anime');
    return {
        getAniListMangaById: vi.mocked(anime.getAniListMangaById),
        searchAniListManga: vi.mocked(anime.searchAniListManga),
        searchAniListMedia: vi.mocked(anime.searchAniListMedia),
    } as const;
}

async function setupMangaCommand(title = 'solo leveling') {
    const upsertTitle = vi.fn().mockResolvedValue(undefined);
    const setup = await setupCommandTest('modules/anime/commands/manga.js', {
        interaction: { stringOptions: { title } },
        managerOverrides: {
            animeManager: {
                titles: { upsertTitle },
            },
        },
    });
    return { ...setup, upsertTitle } as const;
}

describe('manga command', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('searches manga titles and replies with lookup-only results', async () => {
        const { searchAniListManga } = await getAnimeMocks();
        searchAniListManga.mockResolvedValue([mangaResult]);
        const { command, interaction, upsertTitle } = await setupMangaCommand();

        await command.execute(interaction as ChatInputCommandInteraction);

        expect(searchAniListManga).toHaveBeenCalledWith('solo leveling');
        expect(upsertTitle).toHaveBeenCalledWith({ anilistId: mangaResult.id });
        expectReplyHasEmbed(interaction, { titleEquals: 'Manga search: solo leveling', descriptionContains: 'Solo Leveling' });
        expect((interaction.reply as ReturnType<typeof vi.fn>).mock.calls[0]?.[0]).toMatchObject({ components: [] });
    });

    it('resolves an exact AniList manga selection', async () => {
        const { getAniListMangaById } = await getAnimeMocks();
        getAniListMangaById.mockResolvedValue(mangaResult);
        const { command, interaction, upsertTitle } = await setupMangaCommand('anilist:30013');

        await command.execute(interaction as ChatInputCommandInteraction);

        expect(getAniListMangaById).toHaveBeenCalledWith(30013);
        expect(upsertTitle).toHaveBeenCalledWith({ anilistId: mangaResult.id });
        expectReplyHasEmbed(interaction, { titleEquals: 'Solo Leveling', field: { nameEquals: 'Chapters', valueEquals: '201 chapters' } });
        expect((interaction.reply as ReturnType<typeof vi.fn>).mock.calls[0]?.[0]).toMatchObject({ components: [] });
    });

    it('returns an ephemeral message when an exact manga selection is missing', async () => {
        const { getAniListMangaById } = await getAnimeMocks();
        getAniListMangaById.mockResolvedValue(null);
        const { command, interaction } = await setupMangaCommand('anilist:404');

        await command.execute(interaction as ChatInputCommandInteraction);

        expectEphemeralReply(interaction, { equals: 'No manga found for `anilist:404`.' });
    });

    it('autocompletes against manga search only', async () => {
        const { searchAniListMedia } = await getAnimeMocks();
        searchAniListMedia.mockResolvedValue([mangaResult]);
        const { command } = await setupMangaCommand();
        const interaction = createMockAutocompleteInteraction({ focused: 'solo' });

        await command.autocomplete(interaction as AutocompleteInteraction);

        expect(searchAniListMedia).toHaveBeenCalledWith('solo', 'MANGA');
        expect(interaction.respond).toHaveBeenCalledWith([
            expect.objectContaining({ name: 'Solo Leveling (South Korea - Manhwa - Finished)', value: 'anilist:30013' }),
        ]);
    });
});
