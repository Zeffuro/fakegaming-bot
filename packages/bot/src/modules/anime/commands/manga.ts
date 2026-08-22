import { runtimeText } from '../../../core/runtimeCopy.js';
import {
    AutocompleteInteraction,
    ChatInputCommandInteraction,
    MessageFlags,
    SlashCommandBuilder,
} from 'discord.js';
import {
    getAniListMangaById,
    mapAniListTitleToInput,
    searchAniListManga,
    searchAniListMangaPage,
    type AniListTitle,
} from '@zeffuro/fakegaming-common/anime';
import { getConfigManager } from '@zeffuro/fakegaming-common/managers';
import { createSlashCommand, getTestOnly } from '../../../core/commandBuilder.js';
import { resolveInteractionOutputLocale } from '../../../core/localization.js';
import { manga as META } from '../commands.manifest.js';
import { anilistAutocomplete, parseAniListChoice } from '../shared/anilistAutocomplete.js';
import { buildAnimeEmbed, buildAnimeSearchResultsEmbed } from '../shared/animeEmbed.js';

const data = createSlashCommand(META, (b: SlashCommandBuilder) =>
    b.addStringOption((option) =>
        option
            .setName('title')
            .setDescription('Manga, manhwa, webtoon, or light novel title')
            .setRequired(true)
            .setAutocomplete(true)
    )
);

async function cacheManga(manga: AniListTitle): Promise<void> {
    await getConfigManager().animeManager.titles.upsertTitle(mapAniListTitleToInput(manga));
}

async function resolveManga(input: string): Promise<AniListTitle | null> {
    const selectedId = parseAniListChoice(input);
    const manga = selectedId ? await getAniListMangaById(selectedId) : (await searchAniListManga(input))[0] ?? null;
    if (!manga) return null;
    await cacheManga(manga);
    return manga;
}

async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
    const locale = await resolveInteractionOutputLocale(interaction);
    const input = interaction.options.getString('title', true);
    const selectedId = parseAniListChoice(input);
    if (!selectedId) {
        const { items: results, failure } = await searchAniListMangaPage(input);
        if (failure) {
            const key = failure.kind === 'rate-limited' ? 'anilistRateLimited' : 'anilistUnavailable';
            await interaction.reply({ content: runtimeText(locale, 'anime', key), flags: MessageFlags.Ephemeral });
            return;
        }
        for (const result of results.slice(0, 10)) {
            await cacheManga(result);
        }
        await interaction.reply({
            embeds: [buildAnimeSearchResultsEmbed(results, input, 'MANGA', locale)],
            components: [],
            flags: results.length ? undefined : MessageFlags.Ephemeral,
        });
        return;
    }

    const manga = await resolveManga(input);
    if (!manga) {
        await interaction.reply({content: runtimeText(locale, 'anime', 'noMangaFoundFor', {query: input}), flags: MessageFlags.Ephemeral});
        return;
    }

    await interaction.reply({
        embeds: [buildAnimeEmbed(manga, locale)],
        components: [],
    });
}

async function autocomplete(interaction: AutocompleteInteraction): Promise<void> {
    const locale = await resolveInteractionOutputLocale(interaction);
    await anilistAutocomplete(interaction, 'MANGA', locale);
}

const testOnly = getTestOnly(META);

// noinspection JSUnusedGlobalSymbols
export default { data, execute, testOnly, autocomplete };
