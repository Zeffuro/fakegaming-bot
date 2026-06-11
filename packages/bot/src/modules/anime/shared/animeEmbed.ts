import { EmbedBuilder } from 'discord.js';
import type { AniListTitle, AniListAiringScheduleItem, AniListPageInfo } from '@zeffuro/fakegaming-common/anime';
import type { AnimeTitle } from '@zeffuro/fakegaming-common/models';
import type { CreationAttributes } from 'sequelize';
import {
    formatAiringTimestamp,
    formatAnimeStatus,
    formatAnimeTitle,
    formatGenres,
    stripAniListDescription,
    truncateText,
} from './animeFormatters.js';

function parseAniListColor(color?: string | null): number {
    if (!color || !/^#[0-9a-f]{6}$/i.test(color)) return 0x02A9FF;
    return Number.parseInt(color.slice(1), 16);
}

export function buildAnimeEmbed(anime: AniListTitle): EmbedBuilder {
    const description = truncateText(stripAniListDescription(anime.description), 700);
    const nextAiringMs = anime.nextAiringEpisode ? anime.nextAiringEpisode.airingAt * 1000 : null;

    const embed = new EmbedBuilder()
        .setColor(parseAniListColor(anime.coverImage?.color))
        .setTitle(formatAnimeTitle(anime))
        .setDescription(description)
        .setURL(anime.siteUrl ?? `https://anilist.co/anime/${anime.id}`)
        .setFooter({ text: `AniList ID ${anime.id}` });

    if (anime.coverImage?.large) embed.setThumbnail(anime.coverImage.large);
    if (anime.bannerImage) embed.setImage(anime.bannerImage);

    embed.addFields(
        { name: 'Status', value: formatAnimeStatus(anime.status), inline: true },
        { name: 'Format', value: anime.format?.replace(/_/g, ' ') ?? 'Unknown', inline: true },
        { name: 'Episodes', value: anime.episodes ? String(anime.episodes) : 'Unknown', inline: true },
        { name: 'Score', value: anime.averageScore ? `${anime.averageScore}/100` : 'Unknown', inline: true },
        { name: 'Genres', value: formatGenres(anime.genres), inline: false },
        {
            name: 'Next Episode',
            value: anime.nextAiringEpisode
                ? `Episode ${anime.nextAiringEpisode.episode}: ${formatAiringTimestamp(nextAiringMs)}`
                : 'No upcoming episode known.',
            inline: false,
        },
    );

    return embed;
}

export function buildAnimeListEmbed(
    subscriptions: Array<{ title: CreationAttributes<AnimeTitle>; reminderMinutes: number }>,
    options: { page?: number; total?: number; startIndex?: number } = {},
): EmbedBuilder {
    const startIndex = options.startIndex ?? 0;
    const description = subscriptions.length
        ? subscriptions.map((sub, index) => {
            const status = sub.title.status ? ` - ${formatAnimeStatus(sub.title.status)}` : '';
            const next = sub.title.nextAiringAt ? ` - next ${formatAiringTimestamp(Number(sub.title.nextAiringAt))}` : '';
            return `**${startIndex + index + 1}. ${formatAnimeTitle(sub.title)}**\n${sub.reminderMinutes} min reminder${status}${next}`;
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

export function buildAnimeSearchResultsEmbed(items: AniListTitle[], query: string): EmbedBuilder {
    const description = items.length
        ? items.slice(0, 10).map((anime, index) => {
            const meta = [
                anime.seasonYear ?? 'unknown year',
                anime.format ?? 'ANIME',
                formatAnimeStatus(anime.status),
                anime.episodes ? `${anime.episodes} eps` : null,
                anime.nextAiringEpisode ? `ep ${anime.nextAiringEpisode.episode} ${formatAiringTimestamp(anime.nextAiringEpisode.airingAt * 1000)}` : null,
            ].filter(Boolean).join(' - ');
            return `**${index + 1}. ${formatAnimeTitle(anime)}**\n${meta}\n${anime.siteUrl ?? `https://anilist.co/anime/${anime.id}`}`;
        }).join('\n\n')
        : `No anime found for \`${query}\`.`;

    const embed = new EmbedBuilder()
        .setColor(0x02A9FF)
        .setTitle(`Anime search: ${query}`)
        .setDescription(truncateText(description, 3900))
        .setFooter({ text: 'Use autocomplete for exact selection, or a Subscribe button for DM reminders.' });
    if (items[0]?.coverImage?.large) embed.setThumbnail(items[0].coverImage.large);
    return embed;
}

function formatSeasonLine(anime: AniListTitle, index: number): string {
    const meta = [
        anime.format?.replace(/_/g, ' ') ?? 'ANIME',
        formatAnimeStatus(anime.status),
        anime.episodes ? `${anime.episodes} eps` : null,
        anime.averageScore ? `${anime.averageScore}/100` : 'unscored',
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
