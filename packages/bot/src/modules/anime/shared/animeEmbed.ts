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

function formatMediaCount(value: number | null | undefined, label: string): string {
    return value ? `${value} ${label}${value === 1 ? '' : 's'}` : 'Unknown';
}

function addTitleMetadataFields(embed: EmbedBuilder, anime: AniListTitle): void {
    const displayTitle = formatAnimeTitle(anime);
    if (anime.title.romaji && anime.title.romaji !== displayTitle) {
        embed.addFields({ name: 'Romaji', value: truncateText(anime.title.romaji, 250), inline: false });
    }
    if (anime.title.native && anime.title.native !== displayTitle && anime.title.native !== anime.title.romaji) {
        embed.addFields({ name: 'Native', value: truncateText(anime.title.native, 250), inline: false });
    }
    const synonyms = anime.synonyms?.filter((synonym) => synonym && synonym !== displayTitle && synonym !== anime.title.romaji).slice(0, 6) ?? [];
    if (synonyms.length) {
        embed.addFields({ name: 'Synonyms', value: truncateText(synonyms.join('\n'), 700), inline: false });
    }
}

function formatRankingLines(anime: AniListTitle): string | null {
    const rankings = anime.rankings?.filter((rank) => rank.allTime).slice(0, 3) ?? anime.rankings?.slice(0, 3) ?? [];
    return rankings.length ? rankings.map(formatAniListRanking).join('\n') : null;
}

export function buildAnimeEmbed(anime: AniListTitle): EmbedBuilder {
    const description = truncateText(stripAniListDescription(anime.description), 700);
    const nextAiringMs = anime.nextAiringEpisode ? anime.nextAiringEpisode.airingAt * 1000 : null;
    const mediaType = getAniListMediaType(anime);

    const embed = new EmbedBuilder()
        .setColor(parseAniListColor(anime.coverImage?.color))
        .setTitle(formatAnimeTitle(anime))
        .setDescription(description)
        .setURL(getAniListMediaUrl(anime))
        .setFooter({ text: `AniList ID ${anime.id}` });

    if (anime.coverImage?.large) embed.setThumbnail(anime.coverImage.large);
    if (anime.bannerImage) embed.setImage(anime.bannerImage);
    addTitleMetadataFields(embed, anime);

    if (mediaType === 'MANGA') {
        const rankings = formatRankingLines(anime);
        embed.addFields(
            { name: 'Status', value: formatAniListStatus(anime.status), inline: true },
            { name: 'Format', value: formatAniListMediaFormat({ format: anime.format, type: mediaType, countryOfOrigin: anime.countryOfOrigin }), inline: true },
            { name: 'Origin', value: formatAniListCountryOfOrigin(anime.countryOfOrigin), inline: true },
            { name: 'Chapters', value: formatMediaCount(anime.chapters, 'chapter'), inline: true },
            { name: 'Volumes', value: formatMediaCount(anime.volumes, 'volume'), inline: true },
            { name: 'Rating', value: formatAniListScore(anime), inline: true },
            { name: 'Popularity', value: formatAniListPopularity(anime.popularity), inline: true },
            { name: 'Genres', value: formatGenres(anime.genres), inline: false },
        );
        if (rankings) embed.addFields({ name: 'Rankings', value: rankings, inline: false });
        return embed;
    }

    const rankings = formatRankingLines(anime);
    embed.addFields(
        { name: 'Status', value: formatAniListStatus(anime.status), inline: true },
        { name: 'Format', value: formatAniListMediaFormat({ format: anime.format, type: mediaType, countryOfOrigin: anime.countryOfOrigin }), inline: true },
        { name: 'Episodes', value: anime.episodes ? String(anime.episodes) : 'Unknown', inline: true },
        { name: 'Rating', value: formatAniListScore(anime), inline: true },
        { name: 'Popularity', value: formatAniListPopularity(anime.popularity), inline: true },
        { name: 'Genres', value: formatGenres(anime.genres), inline: false },
        {
            name: 'Next Episode',
            value: anime.nextAiringEpisode
                ? `Episode ${anime.nextAiringEpisode.episode}: ${formatAiringTimestamp(nextAiringMs)}`
                : 'No upcoming episode known.',
            inline: false,
        },
    );
    if (rankings) embed.addFields({ name: 'Rankings', value: rankings, inline: false });

    return embed;
}

export function buildAnimeListEmbed(
    subscriptions: Array<{ title: CreationAttributes<AnimeTitle>; reminderMinutes: number; paused?: boolean | null }>,
    options: { page?: number; total?: number; startIndex?: number } = {},
): EmbedBuilder {
    const startIndex = options.startIndex ?? 0;
    const description = subscriptions.length
        ? subscriptions.map((sub, index) => {
            const status = sub.title.status ? ` - ${formatAniListStatus(sub.title.status)}` : '';
            const next = sub.title.nextAiringAt ? ` - next ${formatAiringTimestamp(Number(sub.title.nextAiringAt))}` : '';
            const paused = sub.paused ? ' - paused' : '';
            return `**${startIndex + index + 1}. ${formatAnimeTitle(sub.title)}**\n${sub.reminderMinutes} min reminder${status}${next}${paused}`;
        }).join('\n\n')
        : 'No anime subscriptions yet.';

    const embed = new EmbedBuilder()
        .setColor(0x02A9FF)
        .setTitle('Anime subscriptions')
        .setDescription(truncateText(description, 3900));

    if (options.page && options.total !== undefined) {
        embed.setFooter({ text: `Page ${options.page} - ${options.total} subscription${options.total === 1 ? '' : 's'}` });
    }

    return embed;
}

export function buildAnimeNextEmbed(items: AniListAiringScheduleItem[]): EmbedBuilder {
    const description = items.length
        ? items
            .slice(0, 10)
            .map((item) => {
                const title = item.media ? formatAnimeTitle(item.media) : `AniList #${item.mediaId}`;
                return `- **${title}** episode ${item.episode}: ${formatAiringTimestamp(item.airingAt * 1000)}`;
            })
            .join('\n')
        : 'No upcoming episodes found for your subscriptions.';

    return new EmbedBuilder()
        .setColor(0x02A9FF)
        .setTitle('Upcoming anime episodes')
        .setDescription(truncateText(description, 3900));
}

export function buildAnimeSearchResultsEmbed(items: AniListTitle[], query: string, mediaType: 'ANIME' | 'MANGA' = 'ANIME'): EmbedBuilder {
    const label = mediaType === 'MANGA' ? 'Manga' : 'Anime';
    const description = items.length
        ? items.slice(0, 10).map((anime, index) => {
            const meta = [
                mediaType === 'MANGA' ? formatAniListCountryOfOrigin(anime.countryOfOrigin) : anime.seasonYear ?? 'unknown year',
                formatAniListMediaFormat({ format: anime.format, type: mediaType, countryOfOrigin: anime.countryOfOrigin }),
                formatAniListStatus(anime.status),
                mediaType === 'MANGA' ? formatMediaCount(anime.chapters, 'chapter') : anime.episodes ? `${anime.episodes} eps` : null,
                anime.averageScore ? `${anime.averageScore}/100` : null,
                anime.popularity ? `${formatAniListPopularity(anime.popularity)} users` : null,
                mediaType === 'ANIME' && anime.nextAiringEpisode ? `ep ${anime.nextAiringEpisode.episode} ${formatAiringTimestamp(anime.nextAiringEpisode.airingAt * 1000)}` : null,
            ].filter(Boolean).join(' - ');
            const romaji = anime.title.romaji && anime.title.romaji !== formatAnimeTitle(anime) ? `\nRomaji: ${anime.title.romaji}` : '';
            return `**${index + 1}. ${formatAnimeTitle(anime)}**${romaji}\n${meta}\n${getAniListMediaUrl(anime)}`;
        }).join('\n\n')
        : `No ${label.toLowerCase()} found for \`${query}\`.`;

    const embed = new EmbedBuilder()
        .setColor(0x02A9FF)
        .setTitle(`${label} search: ${query}`)
        .setDescription(truncateText(description, 3900));
    if (mediaType === 'ANIME') {
        embed.setFooter({ text: 'Use autocomplete for exact selection, or a Subscribe button for DM reminders.' });
    } else {
        embed.setFooter({ text: 'Use autocomplete for exact selection.' });
    }
    if (items[0]?.coverImage?.large) embed.setThumbnail(items[0].coverImage.large);
    return embed;
}

function formatSeasonLine(anime: AniListTitle, index: number): string {
    const meta = [
        formatAniListMediaFormat({ format: anime.format, type: 'ANIME', countryOfOrigin: anime.countryOfOrigin }),
        formatAniListStatus(anime.status),
        anime.episodes ? `${anime.episodes} eps` : null,
        anime.averageScore ? `${anime.averageScore}/100` : 'unscored',
        anime.popularity ? `${formatAniListPopularity(anime.popularity)} users` : null,
    ].filter(Boolean).join(' - ');
    const next = anime.nextAiringEpisode
        ? `\nNext: episode ${anime.nextAiringEpisode.episode} ${formatAiringTimestamp(anime.nextAiringEpisode.airingAt * 1000)}`
        : '';
    return `**${index}. ${formatAnimeTitle(anime)}**\n${meta}${next}`;
}

export function buildAnimeSeasonEmbed(
    items: AniListTitle[],
    label: string,
    pageInfo?: AniListPageInfo,
): EmbedBuilder {
    const page = pageInfo?.currentPage ?? 1;
    const perPage = pageInfo?.perPage ?? items.length;
    const offset = Math.max(0, page - 1) * Math.max(1, perPage || 1);
    const description = items.length
        ? items.slice(0, 10).map((anime, index) => formatSeasonLine(anime, offset + index + 1)).join('\n\n')
        : 'No anime found for that season.';

    const footer = pageInfo?.total
        ? `Page ${page}/${pageInfo.lastPage ?? '?'} - ${pageInfo.total} titles`
        : `Page ${page}${pageInfo?.hasNextPage ? ' - more results available' : ''}`;

    const embed = new EmbedBuilder()
        .setColor(0x02A9FF)
        .setTitle(`Anime season: ${label}`)
        .setDescription(truncateText(description, 3900))
        .setFooter({ text: footer });

    if (items[0]?.coverImage?.large) embed.setThumbnail(items[0].coverImage.large);

    return embed;
}
