import type { AniListMediaRank, AniListMediaType } from './anilistClient.js';

export type AniListCountryCode = 'JP' | 'KR' | 'CN' | 'TW';

export const ANILIST_MANGA_ORIGIN_LABELS = {
    JP: 'Manga',
    KR: 'Manhwa',
    CN: 'Manhua',
    TW: 'Manhua',
} as const satisfies Record<AniListCountryCode, string>;

export const ANILIST_COUNTRY_NAMES = {
    JP: 'Japan',
    KR: 'South Korea',
    CN: 'China',
    TW: 'Taiwan',
} as const satisfies Record<AniListCountryCode, string>;

const ANILIST_FORMAT_LABELS = {
    TV: 'TV',
    TV_SHORT: 'TV Short',
    OVA: 'OVA',
    ONA: 'ONA',
    MOVIE: 'Movie',
    SPECIAL: 'Special',
    MUSIC: 'Music',
} as const satisfies Record<string, string>;

function formatEnumLabel(value: string): string {
    const known = ANILIST_FORMAT_LABELS[value as keyof typeof ANILIST_FORMAT_LABELS];
    if (known) return known;
    return value.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, (char) => char.toUpperCase());
}

export function formatAniListStatus(status?: string | null): string {
    return status ? formatEnumLabel(status) : 'Unknown';
}

export function formatAniListCountryOfOrigin(country?: string | null): string {
    if (!country) return 'Unknown';
    return ANILIST_COUNTRY_NAMES[country as AniListCountryCode] ?? country;
}

export function formatAniListMediaFormat(args: {
    format?: string | null;
    type?: AniListMediaType | null;
    countryOfOrigin?: string | null;
}): string {
    if (!args.format) return 'Unknown';
    if (args.type === 'MANGA') {
        if (args.format === 'MANGA') {
            return ANILIST_MANGA_ORIGIN_LABELS[args.countryOfOrigin as AniListCountryCode] ?? 'Manga';
        }
        if (args.format === 'NOVEL') return 'Novel';
        if (args.format === 'ONE_SHOT') return 'One-shot';
    }
    return formatEnumLabel(args.format);
}

export function formatAniListScore(args: { averageScore?: number | null; meanScore?: number | null }): string {
    const scores = [
        args.averageScore ? `Average ${args.averageScore}/100` : null,
        args.meanScore ? `Mean ${args.meanScore}/100` : null,
    ].filter(Boolean);
    return scores.length ? scores.join(' - ') : 'Unknown';
}

export function formatAniListPopularity(popularity?: number | null): string {
    return popularity ? popularity.toLocaleString('en-US') : 'Unknown';
}

export function formatAniListAutocompleteMeta(args: {
    seasonYear?: number | null;
    countryOfOrigin?: string | null;
    format?: string | null;
    status?: string | null;
    type?: AniListMediaType | null;
}): string {
    const context = args.type === 'MANGA'
        ? formatAniListCountryOfOrigin(args.countryOfOrigin)
        : args.seasonYear ?? 'Unknown year';
    return [
        context,
        formatAniListMediaFormat({ format: args.format, type: args.type, countryOfOrigin: args.countryOfOrigin }),
        formatAniListStatus(args.status),
    ].join(' - ');
}

export function formatAniListRanking(rank: AniListMediaRank): string {
    const rankingType = rank.type === 'POPULAR' ? 'Most Popular' : rank.type === 'RATED' ? 'Highest Rated' : formatEnumLabel(rank.type ?? 'Ranked');
    const context = rank.allTime
        ? 'All Time'
        : [rank.season ? formatEnumLabel(rank.season) : null, rank.year ?? null].filter(Boolean).join(' ');
    return `#${rank.rank} ${rankingType}${context ? ` ${context}` : ''}`;
}
