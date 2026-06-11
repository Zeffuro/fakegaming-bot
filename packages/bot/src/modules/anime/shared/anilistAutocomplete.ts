import type { AutocompleteInteraction } from 'discord.js';
import { searchAniListAnime } from '@zeffuro/fakegaming-common/anime';
import { formatAnimeTitle, truncateText } from './animeFormatters.js';

export function encodeAniListChoice(id: number): string {
    return `anilist:${id}`;
}

export function parseAniListChoice(value: string): number | null {
    const match = /^anilist:(\d+)$/.exec(value.trim());
    return match ? Number(match[1]) : null;
}

export async function anilistAutocomplete(interaction: AutocompleteInteraction): Promise<void> {
    const focused = interaction.options.getFocused();
    if (typeof focused !== 'string' || focused.trim().length < 2) {
        await interaction.respond([]);
        return;
    }

    const results = await searchAniListAnime(focused);
    await interaction.respond(results.slice(0, 10).map((anime) => ({
        name: truncateText(`${formatAnimeTitle(anime)} (${anime.seasonYear ?? 'unknown'} ${anime.format ?? 'ANIME'} ${anime.status ?? 'UNKNOWN'})`, 100),
        value: encodeAniListChoice(anime.id),
    })));
}
