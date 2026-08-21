import type { AniListMediaRank, AniListMediaType } from './anilistClient.js';
import { createCommonTranslator, getCommonMessages } from '../messages/index.js';
import {
    DEFAULT_OUTPUT_LOCALE,
    getOutputLocaleMetadata,
    type SupportedOutputLocale,
} from '../utils/outputLocale.js';

export type AniListCountryCode = 'JP' | 'KR' | 'CN' | 'TW';

export const ANILIST_MANGA_ORIGIN_LABELS = (
    getCommonMessages('en').anime.mangaOrigin satisfies Record<AniListCountryCode, string>
);

export const ANILIST_COUNTRY_NAMES = getCommonMessages('en').anime.country satisfies Record<AniListCountryCode, string>;

function formatEnumLabel(value: string, locale: SupportedOutputLocale): string {
    const labels: Readonly<Record<string, string>> = getCommonMessages(locale).anime.enum;
    const known = labels[value];
    if (known) return known;
    return value.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, (char) => char.toUpperCase());
}

export function formatAniListStatus(status?: string | null, locale: SupportedOutputLocale = DEFAULT_OUTPUT_LOCALE): string {
    return status ? formatEnumLabel(status, locale) : createCommonTranslator(locale)('anime.copy.unknown');
}

export function formatAniListCountryOfOrigin(country?: string | null, locale: SupportedOutputLocale = DEFAULT_OUTPUT_LOCALE): string {
    if (!country) return createCommonTranslator(locale)('anime.copy.unknown');
    const names: Readonly<Record<string, string>> = getCommonMessages(locale).anime.country;
    return names[country as AniListCountryCode] ?? country;
}

export function formatAniListMediaFormat(args: {
    format?: string | null;
    type?: AniListMediaType | null;
    countryOfOrigin?: string | null;
}, locale: SupportedOutputLocale = DEFAULT_OUTPUT_LOCALE): string {
    const t = createCommonTranslator(locale);
    if (!args.format) return t('anime.copy.unknown');
    if (args.type === 'MANGA') {
        if (args.format === 'MANGA') {
            const originLabels: Readonly<Record<string, string>> = getCommonMessages(locale).anime.mangaOrigin;
            return originLabels[args.countryOfOrigin ?? 'JP'] ?? originLabels.JP;
        }
    }
    return formatEnumLabel(args.format, locale);
}

export function formatAniListScore(
    args: { averageScore?: number | null; meanScore?: number | null },
    locale: SupportedOutputLocale = DEFAULT_OUTPUT_LOCALE,
): string {
    const t = createCommonTranslator(locale);
    const scores = [
        args.averageScore ? `${t('anime.copy.average')} ${args.averageScore}/100` : null,
        args.meanScore ? `${t('anime.copy.mean')} ${args.meanScore}/100` : null,
    ].filter(Boolean);
    return scores.length ? scores.join(' - ') : t('anime.copy.unknown');
}

export function formatAniListPopularity(popularity?: number | null, locale: SupportedOutputLocale = DEFAULT_OUTPUT_LOCALE): string {
    return popularity
        ? popularity.toLocaleString(getOutputLocaleMetadata(locale).formatTag)
        : createCommonTranslator(locale)('anime.copy.unknown');
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
        : args.seasonYear ?? createCommonTranslator(locale)('anime.copy.unknownYear');
    return [
        context,
        formatAniListMediaFormat({ format: args.format, type: args.type, countryOfOrigin: args.countryOfOrigin }, locale),
        formatAniListStatus(args.status, locale),
    ].join(' - ');
}

export function formatAniListRanking(rank: AniListMediaRank, locale: SupportedOutputLocale = DEFAULT_OUTPUT_LOCALE): string {
    const t = createCommonTranslator(locale);
    const rankingType = rank.type === 'POPULAR'
        ? t('anime.copy.mostPopular')
        : rank.type === 'RATED'
            ? t('anime.copy.highestRated')
            : formatEnumLabel(rank.type ?? 'Ranked', locale);
    const context = rank.allTime
        ? t('anime.copy.allTime')
        : [rank.season ? formatEnumLabel(rank.season, locale) : null, rank.year ?? null].filter(Boolean).join(' ');
    return `#${rank.rank} ${rankingType}${context ? ` ${context}` : ''}`;
}
