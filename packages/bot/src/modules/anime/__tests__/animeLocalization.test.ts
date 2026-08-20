import type { ButtonInteraction } from 'discord.js';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
    setupCommandTest,
} from '@zeffuro/fakegaming-common/testing';
import anime from '../commands/anime.js';
import manga from '../commands/manga.js';
import {
    buildAnimeActionRow,
    buildAnimeListPageCustomId,
    buildAnimeSearchActionRows,
} from '../shared/animeComponents.js';
import { buildAnimeEmbed, buildAnimeSearchResultsEmbed } from '../shared/animeEmbed.js';

vi.mock('@zeffuro/fakegaming-common/anime', async (importOriginal) => {
    const actual = await importOriginal<typeof import('@zeffuro/fakegaming-common/anime')>();
    return {
        ...actual,
        getAniListAnimeById: vi.fn().mockResolvedValue(null),
    };
});

interface LocalizedNode {
    name: string;
    description?: string;
    name_localizations?: Record<string, string> | null;
    description_localizations?: Record<string, string> | null;
    options?: LocalizedNode[];
    choices?: Array<{ name_localizations?: Record<string, string> | null }>;
}

function assertLocalized(node: LocalizedNode): void {
    expect(node.name_localizations?.nl, `${node.name} Dutch name`).toBeTruthy();
    if (node.description !== undefined) {
        expect(node.description_localizations?.nl, `${node.name} Dutch description`).toBeTruthy();
    }
    for (const choice of node.choices ?? []) expect(choice.name_localizations?.nl).toBeTruthy();
    for (const option of node.options ?? []) assertLocalized(option);
}

describe('anime localization', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('provides Dutch metadata for all anime and manga command nodes', () => {
        assertLocalized(anime.data.toJSON() as LocalizedNode);
        assertLocalized(manga.data.toJSON() as LocalizedNode);
    });

    it('localizes AniList presentation while preserving provider content', () => {
        const media = {
            id: 30013,
            type: 'MANGA' as const,
            title: { english: 'Provider Title', romaji: 'Provider Romaji' },
            description: 'Provider-owned description.',
            format: 'MANGA',
            status: 'FINISHED',
            countryOfOrigin: 'KR',
            chapters: 2,
            genres: ['Action'],
        };

        const exact = buildAnimeEmbed(media, 'nl').toJSON();
        expect(exact.title).toBe('Provider Title');
        expect(exact.description).toBe('Provider-owned description.');
        expect(exact.fields).toEqual(expect.arrayContaining([
            expect.objectContaining({ name: 'Hoofdstukken', value: '2 hoofdstukken' }),
            expect.objectContaining({ name: 'Herkomst', value: 'Zuid-Korea' }),
        ]));

        const search = buildAnimeSearchResultsEmbed([media], 'provider', 'MANGA', 'nl').toJSON();
        expect(search.title).toBe('Manga zoeken: provider');
        expect(search.description).toContain('Provider Title');
        expect(search.footer?.text).toContain('exacte keuze');
    });

    it('encodes Dutch locale in new components and localizes their labels', () => {
        expect(buildAnimeListPageCustomId(2, 'nl')).toBe('anime:list:2:nl');
        expect(buildAnimeActionRow(10, 'nl').toJSON().components[0]).toMatchObject({
            custom_id: 'anime:subscribe:10:nl',
            label: 'Abonneren',
        });
        expect(buildAnimeSearchActionRows([10], 0, 'nl')[0]?.toJSON().components[0]).toMatchObject({
            custom_id: 'anime:subscribe:10:nl',
            label: 'Abonneren #1',
        });
    });

    it('continues to accept legacy component IDs and uses the stored locale', async () => {
        const subscribeUser = vi.fn().mockResolvedValue(true);
        const { command } = await setupCommandTest('modules/anime/commands/anime.js', {
            managerOverrides: {
                guildLocaleConfigManager: { getOutputLocale: vi.fn().mockResolvedValue('nl') },
                animeManager: {
                    titles: { upsertTitle: vi.fn().mockResolvedValue(undefined) },
                    subscriptions: { subscribeUser },
                },
            },
        });
        const interaction = {
            customId: 'anime:subscribe:404',
            guildId: '135381928284343204',
            user: { id: 'user-1' },
            reply: vi.fn().mockResolvedValue(undefined),
        } as unknown as ButtonInteraction;

        await expect(command.handleComponent(interaction as ButtonInteraction)).resolves.toBe(true);
        expect(subscribeUser).toHaveBeenCalledWith({ anilistId: 404, userId: 'user-1', reminderMinutes: 30 });
        expect(interaction.reply).toHaveBeenCalledWith(expect.objectContaining({
            content: expect.stringContaining('Je bent geabonneerd'),
        }));
    });
});
