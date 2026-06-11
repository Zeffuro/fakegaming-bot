import type { AnimeTitle } from '@zeffuro/fakegaming-common/models';
import type { AniListTitle } from '@zeffuro/fakegaming-common/anime';
import type { CreationAttributes } from 'sequelize';

export function formatAnimeTitle(title: AniListTitle | CreationAttributes<AnimeTitle>): string {
    if ('title' in title) {
        return title.title.english || title.title.romaji || title.title.native || 'Unknown anime';
    }
    return title.titleEnglish || title.titleRomaji || title.titleNative || `AniList #${title.anilistId}`;
}

export function stripAniListDescription(description?: string | null): string {
    if (!description) return 'No description available.';
    return description
        .replace(/<br\s*\/?>/gi, '\n')
        .replace(/<\/?[^>]+>/g, '')
        .replace(/\n{3,}/g, '\n\n')
        .trim();
}

export function truncateText(value: string, maxLength: number): string {
    if (value.length <= maxLength) return value;
    return `${value.slice(0, Math.max(0, maxLength - 3))}...`;
}

export function formatAiringTimestamp(ms?: number | null): string {
    if (!ms) return 'Unknown';
    const seconds = Math.floor(ms / 1000);
    return `<t:${seconds}:F> (<t:${seconds}:R>)`;
}

export function formatGenres(genres?: readonly string[] | null): string {
    if (!genres?.length) return 'Unknown';
    return genres.slice(0, 6).join(', ');
}

export function formatAnimeStatus(status?: string | null): string {
    return status ? status.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, c => c.toUpperCase()) : 'Unknown';
}
