import { EmbedBuilder } from 'discord.js';
import { getOutputLocaleMetadata } from '@zeffuro/fakegaming-common';
import { runtimeText } from '../../../core/runtimeCopy.js';
import type { SupportedOutputLocale } from '../../../core/localization.js';
import {
    getTmdbImageUrl,
    getTmdbWebUrl,
    type TmdbMedia,
} from '../../../services/tmdbService.js';

const TMDB_COLOR = 0x01b4e4;
const TMDB_ATTRIBUTION_URL = 'https://www.themoviedb.org';

export function buildTmdbSearchEmbed(results: TmdbMedia[], query: string, locale: SupportedOutputLocale): EmbedBuilder {
    const embed = new EmbedBuilder()
        .setColor(TMDB_COLOR)
        .setTitle(runtimeText(locale, 'media', 'searchTitle', { query }))
        .setURL(TMDB_ATTRIBUTION_URL)
        .setFooter({ text: runtimeText(locale, 'media', 'attribution') });

    if (!results.length) {
        return embed.setDescription(runtimeText(locale, 'media', 'noResults', { query }));
    }

    return embed.setDescription(results.map((media, index) => {
        const type = mediaTypeLabel(media.type, locale);
        const year = media.releaseDate?.slice(0, 4) || runtimeText(locale, 'media', 'unknownYear');
        const rating = formatRating(media.voteAverage, locale);
        return `**${index + 1}. [${escapeLinkLabel(media.title)}](${getTmdbWebUrl(media)})** - ${type} - ${year}${rating ? ` - ${rating}` : ''}`;
    }).join('\n'));
}

export function buildTmdbMediaEmbed(media: TmdbMedia, locale: SupportedOutputLocale): EmbedBuilder {
    const embed = new EmbedBuilder()
        .setColor(TMDB_COLOR)
        .setTitle(media.title)
        .setURL(getTmdbWebUrl(media))
        .setDescription(truncate(media.overview ?? runtimeText(locale, 'media', 'noDescription'), 3_800))
        .setFooter({ text: runtimeText(locale, 'media', 'attribution') });

    const poster = getTmdbImageUrl(media.posterPath);
    const backdrop = getTmdbImageUrl(media.backdropPath, 'w780');
    if (poster) embed.setThumbnail(poster);
    if (backdrop) embed.setImage(backdrop);

    const fields = [
        { name: runtimeText(locale, 'media', 'type'), value: mediaTypeLabel(media.type, locale), inline: true },
        { name: runtimeText(locale, 'media', 'releaseDate'), value: formatReleaseDate(media.releaseDate, locale), inline: true },
    ];
    const rating = formatRating(media.voteAverage, locale, media.voteCount);
    if (rating) fields.push({ name: runtimeText(locale, 'media', 'rating'), value: rating, inline: true });
    if (media.runtimeMinutes) fields.push({
        name: runtimeText(locale, 'media', 'runtime'),
        value: runtimeText(locale, 'media', 'minutes', { count: media.runtimeMinutes }),
        inline: true,
    });
    if (media.seasonCount) fields.push({
        name: runtimeText(locale, 'media', 'seasons'),
        value: runtimeText(locale, 'media', 'seasonCount', { count: media.seasonCount }),
        inline: true,
    });
    if (media.episodeCount) fields.push({
        name: runtimeText(locale, 'media', 'episodes'),
        value: runtimeText(locale, 'media', 'episodeCount', { count: media.episodeCount }),
        inline: true,
    });
    if (media.status) fields.push({ name: runtimeText(locale, 'media', 'status'), value: media.status, inline: true });
    if (media.originalLanguage) fields.push({
        name: runtimeText(locale, 'media', 'originalLanguage'),
        value: formatLanguage(media.originalLanguage, locale),
        inline: true,
    });
    if (media.originalTitle) fields.push({ name: runtimeText(locale, 'media', 'originalTitle'), value: media.originalTitle, inline: false });
    if (media.genres.length) fields.push({ name: runtimeText(locale, 'media', 'genres'), value: media.genres.join(', '), inline: false });
    return embed.addFields(fields);
}

export function formatTmdbAutocompleteName(media: TmdbMedia, locale: SupportedOutputLocale): string {
    const type = mediaTypeLabel(media.type, locale);
    const year = media.releaseDate?.slice(0, 4) || runtimeText(locale, 'media', 'unknownYear');
    return truncate(`${media.title} (${type} - ${year})`, 100);
}

function mediaTypeLabel(type: TmdbMedia['type'], locale: SupportedOutputLocale): string {
    return runtimeText(locale, 'media', type === 'movie' ? 'movie' : 'tvShow');
}

function formatReleaseDate(value: string | null, locale: SupportedOutputLocale): string {
    if (!value) return runtimeText(locale, 'media', 'unknownDate');
    const date = new Date(`${value}T00:00:00Z`);
    if (Number.isNaN(date.getTime())) return value;
    return new Intl.DateTimeFormat(getOutputLocaleMetadata(locale).formatTag, {
        dateStyle: 'medium',
        timeZone: 'UTC',
    }).format(date);
}

function formatRating(value: number | null, locale: SupportedOutputLocale, voteCount?: number | null): string | null {
    if (value === null || value <= 0) return null;
    const formatTag = getOutputLocaleMetadata(locale).formatTag;
    const rating = value.toLocaleString(formatTag, { maximumFractionDigits: 1 });
    if (!voteCount) return `${rating}/10`;
    return runtimeText(locale, 'media', 'ratingWithVotes', {
        rating,
        count: voteCount.toLocaleString(formatTag),
    });
}

function formatLanguage(code: string, locale: SupportedOutputLocale): string {
    try {
        return new Intl.DisplayNames([getOutputLocaleMetadata(locale).formatTag], { type: 'language' }).of(code) ?? code;
    } catch {
        return code;
    }
}

function escapeLinkLabel(value: string): string {
    return value.replace(/[\\\[\]]/g, '\\$&');
}

function truncate(value: string, maxLength: number): string {
    return value.length <= maxLength ? value : `${value.slice(0, maxLength - 3)}...`;
}
