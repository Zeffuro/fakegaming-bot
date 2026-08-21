import { DEFAULT_OUTPUT_LOCALE } from '@zeffuro/fakegaming-common';
import type { AnimeTitle } from '@zeffuro/fakegaming-common/models';
import type { AniListTitle } from '@zeffuro/fakegaming-common/anime';
import type { CreationAttributes } from 'sequelize';
import type { SupportedOutputLocale } from '../../../core/localization.js';
import { getAnimeCopy } from '../copy/animeCopy.js';
import { runtimeText } from '../../../core/runtimeCopy.js';

export function formatAnimeTitle(
    title: AniListTitle | CreationAttributes<AnimeTitle>,
    locale: SupportedOutputLocale = DEFAULT_OUTPUT_LOCALE,
): string {
    if ('title' in title) {
        return title.title.english || title.title.romaji || title.title.native || getAnimeCopy(locale).unknownAnime;
    }
    return title.titleEnglish || title.titleRomaji || title.titleNative || `AniList #${title.anilistId}`;
}

export function stripAniListDescription(description?: string | null, locale: SupportedOutputLocale = DEFAULT_OUTPUT_LOCALE): string {
    if (!description) return getAnimeCopy(locale).noDescription;
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

export function formatAiringTimestamp(ms?: number | null, locale: SupportedOutputLocale = DEFAULT_OUTPUT_LOCALE): string {
    if (!ms) return getAnimeCopy(locale).unknown;
    const seconds = Math.floor(ms / 1000);
    return `<t:${seconds}:F> (<t:${seconds}:R>)`;
}

export function formatGenres(genres?: readonly string[] | null, locale: SupportedOutputLocale = DEFAULT_OUTPUT_LOCALE): string {
    if (!genres?.length) return getAnimeCopy(locale).unknown;
    return genres.slice(0, 6).join(', ');
}

export function formatAnimeStatus(status?: string | null, locale: SupportedOutputLocale = DEFAULT_OUTPUT_LOCALE): string {
    if (!status) return getAnimeCopy(locale).unknown;
    const keys = {
        NOT_YET_RELEASED: 'statusNotYetReleased', RELEASING: 'statusReleasing', FINISHED: 'statusFinished',
        CANCELLED: 'statusCancelled', HIATUS: 'statusHiatus',
    } as const;
    const key = keys[status as keyof typeof keys];
    return key
        ? runtimeText(locale, 'anime', key)
        : status.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, c => c.toUpperCase());
}
