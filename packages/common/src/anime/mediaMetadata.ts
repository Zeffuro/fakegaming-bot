import type { AniListMediaRank, AniListMediaType } from './anilistClient.js';
import {
    DEFAULT_OUTPUT_LOCALE,
    getOutputLocaleMetadata,
    resolveLocaleValue,
    type OutputLocaleValues,
    type SupportedOutputLocale,
} from '../utils/outputLocale.js';

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

const ANILIST_COUNTRY_NAMES_NL = {
    JP: 'Japan',
    KR: 'Zuid-Korea',
    CN: 'China',
    TW: 'Taiwan',
} as const satisfies Record<AniListCountryCode, string>;

const ANILIST_COUNTRY_NAMES_BY_LOCALE = {
    en: ANILIST_COUNTRY_NAMES,
    nl: ANILIST_COUNTRY_NAMES_NL,
} as const satisfies OutputLocaleValues<Record<AniListCountryCode, string>>;

const ANILIST_FORMAT_LABELS = {
    TV: 'TV',
    TV_SHORT: 'TV Short',
    OVA: 'OVA',
    ONA: 'ONA',
    MOVIE: 'Movie',
    SPECIAL: 'Special',
    MUSIC: 'Music',
} as const satisfies Record<string, string>;

const ANILIST_FORMAT_LABELS_NL: Readonly<Record<string, string>> = {
    TV: 'TV',
    TV_SHORT: 'Korte tv-serie',
    OVA: 'OVA',
    ONA: 'ONA',
    MOVIE: 'Film',
    SPECIAL: 'Special',
    MUSIC: 'Muziek',
    MANGA: 'Manga',
    NOVEL: 'Roman',
    ONE_SHOT: 'One-shot',
};

const ANILIST_ENUM_LABELS_NL: Readonly<Record<string, string>> = {
    RELEASING: 'Wordt uitgezonden',
    FINISHED: 'Afgerond',
    NOT_YET_RELEASED: 'Nog niet verschenen',
    CANCELLED: 'Geannuleerd',
    HIATUS: 'Onderbroken',
    WINTER: 'Winter',
    SPRING: 'Lente',
    SUMMER: 'Zomer',
    FALL: 'Herfst',
    POPULAR: 'Populairst',
    RATED: 'Hoogst beoordeeld',
    RANKED: 'Ranglijst',
};

const ANILIST_ENUM_LABELS_BY_LOCALE: OutputLocaleValues<Readonly<Record<string, string>>> = {
    en: ANILIST_FORMAT_LABELS,
    nl: { ...ANILIST_FORMAT_LABELS_NL, ...ANILIST_ENUM_LABELS_NL },
};

const ANILIST_COPY = {
    en: {
        unknown: 'Unknown',
        unknownYear: 'Unknown year',
        average: 'Average',
        mean: 'Mean',
        novel: 'Novel',
        mostPopular: 'Most Popular',
        highestRated: 'Highest Rated',
        allTime: 'All Time',
    },
    nl: {
        unknown: 'Onbekend',
        unknownYear: 'Onbekend jaar',
        average: 'Gemiddeld',
        mean: 'Gemiddelde score',
        novel: 'Roman',
        mostPopular: 'Populairst',
        highestRated: 'Hoogst beoordeeld',
        allTime: 'aller tijden',
    },
} as const satisfies OutputLocaleValues<Record<string, string>>;

function formatEnumLabel(value: string, locale: SupportedOutputLocale): string {
    const known = resolveLocaleValue(locale, ANILIST_ENUM_LABELS_BY_LOCALE)[value];
    if (known) return known;
    return value.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, (char) => char.toUpperCase());
}

export function formatAniListStatus(status?: string | null, locale: SupportedOutputLocale = DEFAULT_OUTPUT_LOCALE): string {
    return status ? formatEnumLabel(status, locale) : resolveLocaleValue(locale, ANILIST_COPY).unknown;
}

export function formatAniListCountryOfOrigin(country?: string | null, locale: SupportedOutputLocale = DEFAULT_OUTPUT_LOCALE): string {
    if (!country) return resolveLocaleValue(locale, ANILIST_COPY).unknown;
    const names = resolveLocaleValue(locale, ANILIST_COUNTRY_NAMES_BY_LOCALE);
    return names[country as AniListCountryCode] ?? country;
}

export function formatAniListMediaFormat(args: {
    format?: string | null;
    type?: AniListMediaType | null;
    countryOfOrigin?: string | null;
}, locale: SupportedOutputLocale = DEFAULT_OUTPUT_LOCALE): string {
    if (!args.format) return resolveLocaleValue(locale, ANILIST_COPY).unknown;
    if (args.type === 'MANGA') {
        if (args.format === 'MANGA') {
            return ANILIST_MANGA_ORIGIN_LABELS[args.countryOfOrigin as AniListCountryCode] ?? 'Manga';
        }
        if (args.format === 'NOVEL') return resolveLocaleValue(locale, ANILIST_COPY).novel;
        if (args.format === 'ONE_SHOT') return 'One-shot';
    }
    return formatEnumLabel(args.format, locale);
}

export function formatAniListScore(
    args: { averageScore?: number | null; meanScore?: number | null },
    locale: SupportedOutputLocale = DEFAULT_OUTPUT_LOCALE,
): string {
    const copy = resolveLocaleValue(locale, ANILIST_COPY);
    const scores = [
        args.averageScore ? `${copy.average} ${args.averageScore}/100` : null,
        args.meanScore ? `${copy.mean} ${args.meanScore}/100` : null,
    ].filter(Boolean);
    return scores.length ? scores.join(' - ') : copy.unknown;
}

export function formatAniListPopularity(popularity?: number | null, locale: SupportedOutputLocale = DEFAULT_OUTPUT_LOCALE): string {
    return popularity
        ? popularity.toLocaleString(getOutputLocaleMetadata(locale).languageTag)
        : resolveLocaleValue(locale, ANILIST_COPY).unknown;
}

export function formatAniListAutocompleteMeta(args: {
    seasonYear?: number | null;
    countryOfOrigin?: string | null;
    format?: string | null;
    status?: string | null;
    type?: AniListMediaType | null;
}, locale: SupportedOutputLocale = DEFAULT_OUTPUT_LOCALE): string {
    const context = args.type === 'MANGA'
        ? formatAniListCountryOfOrigin(args.countryOfOrigin, locale)
        : args.seasonYear ?? resolveLocaleValue(locale, ANILIST_COPY).unknownYear;
    return [
        context,
        formatAniListMediaFormat({ format: args.format, type: args.type, countryOfOrigin: args.countryOfOrigin }, locale),
        formatAniListStatus(args.status, locale),
    ].join(' - ');
}

export function formatAniListRanking(rank: AniListMediaRank, locale: SupportedOutputLocale = DEFAULT_OUTPUT_LOCALE): string {
    const copy = resolveLocaleValue(locale, ANILIST_COPY);
    const rankingType = rank.type === 'POPULAR'
        ? copy.mostPopular
        : rank.type === 'RATED'
            ? copy.highestRated
            : formatEnumLabel(rank.type ?? 'Ranked', locale);
    const context = rank.allTime
        ? copy.allTime
        : [rank.season ? formatEnumLabel(rank.season, locale) : null, rank.year ?? null].filter(Boolean).join(' ');
    return `#${rank.rank} ${rankingType}${context ? ` ${context}` : ''}`;
}
