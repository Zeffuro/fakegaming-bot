import { DEFAULT_OUTPUT_LOCALE } from '@zeffuro/fakegaming-common';
import { resolveLocaleValue } from '@zeffuro/fakegaming-common';
import { EmbedBuilder } from 'discord.js';
import {
    formatAniListCountryOfOrigin,
    formatAniListMediaFormat,
    formatAniListPopularity,
    formatAniListRanking,
    formatAniListScore,
    formatAniListStatus,
    type AniListTitle,
    type AniListAiringScheduleItem,
    type AniListPageInfo,
} from '@zeffuro/fakegaming-common/anime';
import type { AnimeTitle } from '@zeffuro/fakegaming-common/models';
import type { CreationAttributes } from 'sequelize';
import type { SupportedOutputLocale } from '../../../core/localization.js';
import { getAnimeCopy } from '../copy/animeCopy.js';
import {
    formatAiringTimestamp,
    formatAnimeTitle,
    formatGenres,
    stripAniListDescription,
    truncateText,
} from './animeFormatters.js';

function parseAniListColor(color?: string | null): number {
    if (!color || !/^#[0-9a-f]{6}$/i.test(color)) return 0x02A9FF;
    return Number.parseInt(color.slice(1), 16);
}

function getAniListMediaType(anime: AniListTitle): 'ANIME' | 'MANGA' {
    return anime.type === 'MANGA' ? 'MANGA' : 'ANIME';
}

function getAniListMediaUrl(anime: AniListTitle): string {
    const mediaPath = getAniListMediaType(anime) === 'MANGA' ? 'manga' : 'anime';
    return anime.siteUrl ?? `https://anilist.co/${mediaPath}/${anime.id}`;
}

function formatMediaCount(
    value: number | null | undefined,
    singular: string,
    plural: string,
    locale: SupportedOutputLocale,
): string {
    return value ? `${value} ${value === 1 ? singular : plural}` : getAnimeCopy(locale).unknown;
}

function addTitleMetadataFields(embed: EmbedBuilder, anime: AniListTitle, locale: SupportedOutputLocale): void {
    const copy = getAnimeCopy(locale);
    const displayTitle = formatAnimeTitle(anime, locale);
    if (anime.title.romaji && anime.title.romaji !== displayTitle) {
        embed.addFields({ name: 'Romaji', value: truncateText(anime.title.romaji, 250), inline: false });
    }
    if (anime.title.native && anime.title.native !== displayTitle && anime.title.native !== anime.title.romaji) {
        embed.addFields({ name: copy.native, value: truncateText(anime.title.native, 250), inline: false });
    }
    const synonyms = anime.synonyms?.filter((synonym) => synonym && synonym !== displayTitle && synonym !== anime.title.romaji).slice(0, 6) ?? [];
    if (synonyms.length) {
        embed.addFields({ name: copy.synonyms, value: truncateText(synonyms.join('\n'), 700), inline: false });
    }
}

function formatRankingLines(anime: AniListTitle, locale: SupportedOutputLocale): string | null {
    const rankings = anime.rankings?.filter((rank) => rank.allTime).slice(0, 3) ?? anime.rankings?.slice(0, 3) ?? [];
    return rankings.length ? rankings.map(rank => formatAniListRanking(rank, locale)).join('\n') : null;
}

export function buildAnimeEmbed(anime: AniListTitle, locale: SupportedOutputLocale = DEFAULT_OUTPUT_LOCALE): EmbedBuilder {
    const copy = getAnimeCopy(locale);
    const description = truncateText(stripAniListDescription(anime.description, locale), 700);
    const nextAiringMs = anime.nextAiringEpisode ? anime.nextAiringEpisode.airingAt * 1000 : null;
    const mediaType = getAniListMediaType(anime);

    const embed = new EmbedBuilder()
        .setColor(parseAniListColor(anime.coverImage?.color))
        .setTitle(formatAnimeTitle(anime, locale))
        .setDescription(description)
        .setURL(getAniListMediaUrl(anime))
        .setFooter({ text: `AniList ID ${anime.id}` });

    if (anime.coverImage?.large) embed.setThumbnail(anime.coverImage.large);
    if (anime.bannerImage) embed.setImage(anime.bannerImage);
    addTitleMetadataFields(embed, anime, locale);

    if (mediaType === 'MANGA') {
        const rankings = formatRankingLines(anime, locale);
        embed.addFields(
            { name: copy.status, value: formatAniListStatus(anime.status, locale), inline: true },
            { name: copy.format, value: formatAniListMediaFormat({ format: anime.format, type: mediaType, countryOfOrigin: anime.countryOfOrigin }, locale), inline: true },
            { name: copy.origin, value: formatAniListCountryOfOrigin(anime.countryOfOrigin, locale), inline: true },
            { name: copy.chapters, value: formatMediaCount(anime.chapters, resolveLocaleValue(locale, { en: 'chapter', nl: 'hoofdstuk' }), resolveLocaleValue(locale, { en: 'chapters', nl: 'hoofdstukken' }), locale), inline: true },
            { name: copy.volumes, value: formatMediaCount(anime.volumes, resolveLocaleValue(locale, { en: 'volume', nl: 'deel' }), resolveLocaleValue(locale, { en: 'volumes', nl: 'delen' }), locale), inline: true },
            { name: copy.rating, value: formatAniListScore(anime, locale), inline: true },
            { name: copy.popularity, value: formatAniListPopularity(anime.popularity, locale), inline: true },
            { name: copy.genres, value: formatGenres(anime.genres, locale), inline: false },
        );
        if (rankings) embed.addFields({ name: copy.rankings, value: rankings, inline: false });
        return embed;
    }

    const rankings = formatRankingLines(anime, locale);
    embed.addFields(
        { name: copy.status, value: formatAniListStatus(anime.status, locale), inline: true },
        { name: copy.format, value: formatAniListMediaFormat({ format: anime.format, type: mediaType, countryOfOrigin: anime.countryOfOrigin }, locale), inline: true },
        { name: copy.episodes, value: anime.episodes ? String(anime.episodes) : copy.unknown, inline: true },
        { name: copy.rating, value: formatAniListScore(anime, locale), inline: true },
        { name: copy.popularity, value: formatAniListPopularity(anime.popularity, locale), inline: true },
        { name: copy.genres, value: formatGenres(anime.genres, locale), inline: false },
        {
            name: copy.nextEpisode,
            value: anime.nextAiringEpisode
                ? `${resolveLocaleValue(locale, { en: 'Episode', nl: 'Aflevering' })} ${anime.nextAiringEpisode.episode}: ${formatAiringTimestamp(nextAiringMs, locale)}`
                : copy.noUpcomingEpisode,
            inline: false,
        },
    );
    if (rankings) embed.addFields({ name: copy.rankings, value: rankings, inline: false });

    return embed;
}

export function buildAnimeListEmbed(
    subscriptions: Array<{ title: CreationAttributes<AnimeTitle>; reminderMinutes: number; paused?: boolean | null }>,
    options: { page?: number; total?: number; startIndex?: number } = {},
    locale: SupportedOutputLocale = DEFAULT_OUTPUT_LOCALE,
): EmbedBuilder {
    const copy = getAnimeCopy(locale);
    const startIndex = options.startIndex ?? 0;
    const description = subscriptions.length
        ? subscriptions.map((sub, index) => {
            const status = sub.title.status ? ` - ${formatAniListStatus(sub.title.status, locale)}` : '';
            const next = sub.title.nextAiringAt ? ` - ${copy.next} ${formatAiringTimestamp(Number(sub.title.nextAiringAt), locale)}` : '';
            const paused = sub.paused ? ` - ${copy.paused}` : '';
            return `**${startIndex + index + 1}. ${formatAnimeTitle(sub.title, locale)}**\n${sub.reminderMinutes} ${copy.reminder}${status}${next}${paused}`;
        }).join('\n\n')
        : copy.noSubscriptions;

    const embed = new EmbedBuilder()
        .setColor(0x02A9FF)
        .setTitle(copy.animeSubscriptions)
        .setDescription(truncateText(description, 3900));

    if (options.page && options.total !== undefined) {
        embed.setFooter({ text: `${copy.page} ${options.page} - ${options.total} ${options.total === 1 ? copy.subscription : copy.subscriptions}` });
    }

    return embed;
}

export function buildAnimeNextEmbed(items: AniListAiringScheduleItem[], locale: SupportedOutputLocale = DEFAULT_OUTPUT_LOCALE): EmbedBuilder {
    const copy = getAnimeCopy(locale);
    const description = items.length
        ? items
            .slice(0, 10)
            .map((item) => {
                const title = item.media ? formatAnimeTitle(item.media, locale) : `AniList #${item.mediaId}`;
                return `- **${title}** ${resolveLocaleValue(locale, { en: 'episode', nl: 'aflevering' })} ${item.episode}: ${formatAiringTimestamp(item.airingAt * 1000, locale)}`;
            })
            .join('\n')
        : copy.noUpcomingSubscriptions;

    return new EmbedBuilder()
        .setColor(0x02A9FF)
        .setTitle(copy.upcomingEpisodes)
        .setDescription(truncateText(description, 3900));
}

export function buildAnimeSearchResultsEmbed(
    items: AniListTitle[],
    query: string,
    mediaType: 'ANIME' | 'MANGA' = 'ANIME',
    locale: SupportedOutputLocale = DEFAULT_OUTPUT_LOCALE,
): EmbedBuilder {
    const copy = getAnimeCopy(locale);
    const label = mediaType === 'MANGA' ? copy.manga : copy.anime;
    const description = items.length
        ? items.slice(0, 10).map((anime, index) => {
            const meta = [
                mediaType === 'MANGA' ? formatAniListCountryOfOrigin(anime.countryOfOrigin, locale) : anime.seasonYear ?? copy.unknownYear,
                formatAniListMediaFormat({ format: anime.format, type: mediaType, countryOfOrigin: anime.countryOfOrigin }, locale),
                formatAniListStatus(anime.status, locale),
                mediaType === 'MANGA' ? formatMediaCount(anime.chapters, resolveLocaleValue(locale, { en: 'chapter', nl: 'hoofdstuk' }), resolveLocaleValue(locale, { en: 'chapters', nl: 'hoofdstukken' }), locale) : anime.episodes ? `${anime.episodes} ${copy.episodesShort}` : null,
                anime.averageScore ? `${anime.averageScore}/100` : null,
                anime.popularity ? `${formatAniListPopularity(anime.popularity, locale)} ${copy.users}` : null,
                mediaType === 'ANIME' && anime.nextAiringEpisode ? `${copy.episodeShort} ${anime.nextAiringEpisode.episode} ${formatAiringTimestamp(anime.nextAiringEpisode.airingAt * 1000, locale)}` : null,
            ].filter(Boolean).join(' - ');
            const romaji = anime.title.romaji && anime.title.romaji !== formatAnimeTitle(anime, locale) ? `\n${copy.romaji}: ${anime.title.romaji}` : '';
            return `**${index + 1}. ${formatAnimeTitle(anime, locale)}**${romaji}\n${meta}\n${getAniListMediaUrl(anime)}`;
        }).join('\n\n')
        : resolveLocaleValue(locale, { en: `No ${label.toLowerCase()} found for \`${query}\`.`, nl: `Geen ${label.toLowerCase()} gevonden voor \`${query}\`.` });

    const embed = new EmbedBuilder()
        .setColor(0x02A9FF)
        .setTitle(`${label} ${copy.search}: ${query}`)
        .setDescription(truncateText(description, 3900));
    if (mediaType === 'ANIME') {
        embed.setFooter({ text: copy.exactOrSubscribe });
    } else {
        embed.setFooter({ text: copy.exactSelection });
    }
    if (items[0]?.coverImage?.large) embed.setThumbnail(items[0].coverImage.large);
    return embed;
}

function formatSeasonLine(anime: AniListTitle, index: number, locale: SupportedOutputLocale): string {
    const copy = getAnimeCopy(locale);
    const meta = [
        formatAniListMediaFormat({ format: anime.format, type: 'ANIME', countryOfOrigin: anime.countryOfOrigin }, locale),
        formatAniListStatus(anime.status, locale),
        anime.episodes ? `${anime.episodes} ${copy.episodesShort}` : null,
        anime.averageScore ? `${anime.averageScore}/100` : copy.unscored,
        anime.popularity ? `${formatAniListPopularity(anime.popularity, locale)} ${copy.users}` : null,
    ].filter(Boolean).join(' - ');
    const next = anime.nextAiringEpisode
        ? `\n${resolveLocaleValue(locale, { en: 'Next: episode', nl: 'Volgende: aflevering' })} ${anime.nextAiringEpisode.episode} ${formatAiringTimestamp(anime.nextAiringEpisode.airingAt * 1000, locale)}`
        : '';
    return `**${index}. ${formatAnimeTitle(anime, locale)}**\n${meta}${next}`;
}

export function buildAnimeSeasonEmbed(
    items: AniListTitle[],
    label: string,
    pageInfo?: AniListPageInfo,
    locale: SupportedOutputLocale = DEFAULT_OUTPUT_LOCALE,
): EmbedBuilder {
    const copy = getAnimeCopy(locale);
    const page = pageInfo?.currentPage ?? 1;
    const perPage = pageInfo?.perPage ?? items.length;
    const offset = Math.max(0, page - 1) * Math.max(1, perPage || 1);
    const description = items.length
        ? items.slice(0, 10).map((anime, index) => formatSeasonLine(anime, offset + index + 1, locale)).join('\n\n')
        : copy.noSeasonAnime;

    const footer = pageInfo?.total
        ? `${copy.page} ${page}/${pageInfo.lastPage ?? '?'} - ${pageInfo.total} ${copy.titles}`
        : `${copy.page} ${page}${pageInfo?.hasNextPage ? ` - ${copy.moreResults}` : ''}`;

    const embed = new EmbedBuilder()
        .setColor(0x02A9FF)
        .setTitle(`${copy.season}: ${label}`)
        .setDescription(truncateText(description, 3900))
        .setFooter({ text: footer });

    if (items[0]?.coverImage?.large) embed.setThumbnail(items[0].coverImage.large);

    return embed;
}
