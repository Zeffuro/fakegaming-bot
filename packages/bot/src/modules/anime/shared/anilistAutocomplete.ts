import type { AutocompleteInteraction } from 'discord.js';
import { formatAniListAutocompleteMeta, searchAniListMedia, type AniListMediaType } from '@zeffuro/fakegaming-common/anime';
import { formatAnimeTitle, truncateText } from './animeFormatters.js';

export function encodeAniListChoice(id: number): string {
    return `anilist:${id}`;
}

export function parseAniListChoice(value: string): number | null {
    const match = /^anilist:(\d+)$/.exec(value.trim());
    return match ? Number(match[1]) : null;
}

function parseAutocompleteMediaType(interaction: AutocompleteInteraction): AniListMediaType {
    const type = interaction.options.getString('type', false);
    return type === 'manga' ? 'MANGA' : 'ANIME';
}

export async function anilistAutocomplete(interaction: AutocompleteInteraction, type?: AniListMediaType): Promise<void> {
    const focused = interaction.options.getFocused();
    if (typeof focused !== 'string' || focused.trim().length < 2) {
        await interaction.respond([]);
        return;
    }

    const mediaType = type ?? parseAutocompleteMediaType(interaction);
    const results = await searchAniListMedia(focused, mediaType);
    await interaction.respond(results.slice(0, 10).map((anime) => ({
        name: truncateText(`${formatAnimeTitle(anime)} (${formatAniListAutocompleteMeta({
            seasonYear: anime.seasonYear,
            countryOfOrigin: anime.countryOfOrigin,
            format: anime.format,
            status: anime.status,
            type: mediaType,
        })})`, 100),
        value: encodeAniListChoice(anime.id),
    })));
}
