import axios from 'axios';
import Parser from 'rss-parser';
import {
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    ChannelType,
    Client,
    EmbedBuilder,
    TextChannel,
} from 'discord.js';
import { getConfigManager } from '@zeffuro/fakegaming-common/managers';
import { isWithinQuietHours } from '@zeffuro/fakegaming-common/utils';
import { getLogger } from '@zeffuro/fakegaming-common';
import { renderTemplate } from '@zeffuro/fakegaming-common/utils';

const log = getLogger({ name: 'youtubeService' });

type LoggerLike = { info: (...args: unknown[]) => unknown; warn: (...args: unknown[]) => unknown; debug: (...args: unknown[]) => unknown; error: (...args: unknown[]) => unknown };

// ---- Types ----
interface MediaThumbnailNode { $?: { url?: string }; url?: string }
interface YoutubeFeedItem {
    ['yt:videoId']?: string;
    title?: string;
    link?: string;
    author?: string;
    published?: string;
    mediaThumbnail?: { $: { url?: string } };
    mediaGroup?: {
        ['media:thumbnail']?: MediaThumbnailNode | MediaThumbnailNode[];
        mediaThumbnail?: MediaThumbnailNode | MediaThumbnailNode[];
    };
}

interface YoutubeVideosApiItem {
    contentDetails?: { duration?: string };
    statistics?: { viewCount?: string };
    id?: string;
}

// ---- Helpers ----
function getYoutubeApiKey(): string | null {
    const key = process.env.YOUTUBE_API_KEY;
    return typeof key === 'string' && key.length > 0 ? key : null;
}

const parser = new Parser({
    customFields: {
        item: [
            'yt:videoId',
            'author',
            'published',
            'title',
            ['media:group', 'mediaGroup', { keepArray: false }],
            ['media:community', 'mediaCommunity', { keepArray: false }],
            ['media:thumbnail', 'mediaThumbnail', { keepArray: false }],
            ['media:description', 'mediaDescription', { keepArray: false }],
            ['media:statistics', 'mediaStatistics', { keepArray: false }],
            ['media:starRating', 'mediaStarRating', { keepArray: false }],
        ],
    },
});

function getYoutubeThumbnailUrl(item: YoutubeFeedItem): string | null {
    const group = item.mediaGroup;
    const fromGroupRaw = group?.['media:thumbnail'] ?? group?.mediaThumbnail;
    const node: MediaThumbnailNode | null = Array.isArray(fromGroupRaw) ? (fromGroupRaw[0] ?? null) : (fromGroupRaw ?? null);
    const fromGroupUrl = node?.$?.url ?? node?.url;
    if (fromGroupUrl && fromGroupUrl.startsWith('http')) return fromGroupUrl;

    const fromFeed = item.mediaThumbnail?.$.url;
    if (fromFeed && fromFeed.startsWith('http')) return fromFeed;

    const id = item['yt:videoId'];
    if (id && /^[-_a-zA-Z0-9]{6,}$/.test(id)) return `https://i.ytimg.com/vi/${id}/hqdefault.jpg`;
    return null;
}

function shouldEnrich(): boolean {
    return process.env.YOUTUBE_ENRICH_EMBEDS === '1' || process.env.YOUTUBE_ENRICH_EMBEDS === 'true';
}

async function fetchYoutubeVideoDetailsBatch(videoIds: string[]): Promise<Map<string, { duration?: string; viewCount?: string }>> {
    const out = new Map<string, { duration?: string; viewCount?: string }>();
    const apiKey = getYoutubeApiKey();
    if (!shouldEnrich() || !apiKey) return out;
    const ids = Array.from(new Set(videoIds)).filter((v) => v.length > 0);
    if (ids.length === 0) return out;

    const chunkSize = 50;
    for (let i = 0; i < ids.length; i += chunkSize) {
        const chunk = ids.slice(i, i + chunkSize);
        try {
            const url = `https://www.googleapis.com/youtube/v3/videos?part=contentDetails,statistics&id=${encodeURIComponent(chunk.join(','))}&key=${apiKey}`;
            const res = await axios.get(url);
            const items: YoutubeVideosApiItem[] = res?.data?.items ?? [];
            for (let j = 0; j < items.length; j++) {
                const item = items[j];
                const id = item.id ?? (chunk.length === 1 ? chunk[0] : undefined);
                if (!id) continue;
                out.set(id, { duration: item.contentDetails?.duration, viewCount: item.statistics?.viewCount });
            }
        } catch (err) {
            // ignore
            log.debug({ err, chunkSize: chunk.length }, 'Failed to fetch YouTube video details chunk');
        }
    }
    return out;
}

function formatYoutubeDuration(iso8601: string): string | null {
    const m = /^P(?:([0-9]+)D)?T?(?:([0-9]+)H)?(?:([0-9]+)M)?(?:([0-9]+)S)?$/i.exec(iso8601);
    if (!m) return null;
    const days = m[1] ? Number(m[1]) : 0;
    const hours = m[2] ? Number(m[2]) : 0;
    const minutes = m[3] ? Number(m[3]) : 0;
    const seconds = m[4] ? Number(m[4]) : 0;
    const parts: string[] = [];
    if (days > 0) parts.push(`${days}d`);
    if (hours > 0) parts.push(`${hours}h`);
    if (minutes > 0) parts.push(`${minutes}m`);
    if (seconds > 0 || parts.length === 0) parts.push(`${seconds}s`);
    return parts.join(' ');
}

// ---- Public API ----
export async function getYoutubeChannelId(identifier: string, opts?: { logger?: LoggerLike }): Promise<string | null> {
    const logger: LoggerLike = opts?.logger ?? log;
    const isChannelId = /^UC[\w-]{22}$/.test(identifier);
    const isHandle = identifier.startsWith('@');

    if (isChannelId) {
        const feed = await getYoutubeChannelFeed(identifier, { logger });
        return feed ? identifier : null;
    }

    const base = 'https://www.googleapis.com/youtube/v3/channels?part=id';
    const apiKey = getYoutubeApiKey() ?? '';
    const url = isHandle
        ? `${base}&forHandle=${encodeURIComponent(identifier.substring(1))}&key=${apiKey}`
        : `${base}&forUsername=${encodeURIComponent(identifier)}&key=${apiKey}`;
    try {
        const res = await axios.get(url);
        return res.data.items?.[0]?.id ?? null;
    } catch (error) {
        logger.error({ error, identifier, isHandle }, 'Error fetching YouTube channel ID');
        return null;
    }
}

export async function getYoutubeChannelFeed(channelId: string, opts?: { logger?: LoggerLike }): Promise<YoutubeFeedItem[] | null> {
    const logger: LoggerLike = opts?.logger ?? log;
    const feedUrl = `https://www.youtube.com/feeds/videos.xml?channel_id=${encodeURIComponent(channelId)}`;
    try {
        const feed = await parser.parseURL(feedUrl);
        const items = (feed.items ?? []) as YoutubeFeedItem[];
        return items.length > 0 ? items : null;
    } catch (error) {
        logger.error({ error, channelId }, 'Error fetching YouTube channel feed');
        return null;
    }
}

export async function checkAndAnnounceNewVideos(client: Client, opts?: { logger?: LoggerLike }): Promise<void> {
    const logger: LoggerLike = opts?.logger ?? log;
    const youtubeManager = getConfigManager().youtubeManager;
    const notifications = getConfigManager().notificationsManager;
    const channels = await youtubeManager.getAllChannels();
    if (!channels || channels.length === 0) return;

    await Promise.all(
        channels.map(async (ytChannel: any, idx: number) => {
            try {
                if (!ytChannel.youtubeChannelId || !ytChannel.discordChannelId) return;

                const feedItems = await getYoutubeChannelFeed(ytChannel.youtubeChannelId);
                if (!feedItems || feedItems.length === 0) return;

                let newVideos: YoutubeFeedItem[];
                if (ytChannel.lastVideoId) {
                    const idxLast = feedItems.findIndex((it) => it['yt:videoId'] === ytChannel.lastVideoId);
                    newVideos = idxLast === 0 ? [] : idxLast > 0 ? feedItems.slice(0, idxLast).reverse() : [feedItems[0]];
                } else {
                    newVideos = [feedItems[0]];
                }
                if (newVideos.length === 0) return;

                const discordChannel = client.channels.cache.get(ytChannel.discordChannelId);
                if (
                    !discordChannel ||
                    !(
                        discordChannel.type === ChannelType.GuildText ||
                        discordChannel.type === ChannelType.GuildAnnouncement ||
                        discordChannel.type === ChannelType.PublicThread ||
                        discordChannel.type === ChannelType.PrivateThread
                    )
                ) {
                    return;
                }

                const now = new Date();
                const suppressedByQuiet = isWithinQuietHours(
                    (ytChannel as any).quietHoursStart ?? null,
                    (ytChannel as any).quietHoursEnd ?? null,
                    now,
                );
                const cooldownMinutes = (ytChannel as any).cooldownMinutes as number | null | undefined;
                const lastNotifiedAt = (ytChannel as any).lastNotifiedAt as Date | string | null | undefined;
                const lastNotifiedDate = lastNotifiedAt ? new Date(lastNotifiedAt) : null;
                const suppressedByCooldown = typeof cooldownMinutes === 'number' && cooldownMinutes > 0 && lastNotifiedDate
                    ? now.getTime() - lastNotifiedDate.getTime() < cooldownMinutes * 60_000
                    : false;

                const detailsById = !suppressedByQuiet && !suppressedByCooldown
                    ? await fetchYoutubeVideoDetailsBatch(
                        newVideos.map((v) => v['yt:videoId']).filter((v): v is string => typeof v === 'string'),
                    )
                    : new Map<string, { duration?: string; viewCount?: string }>();

                let sentAny = false;

                for (const video of newVideos) {
                    const videoId = video['yt:videoId'];
                    if (!videoId) continue;

                    const alreadyNotified = await notifications.has('youtube', videoId);
                    if (alreadyNotified || suppressedByQuiet || suppressedByCooldown) {
                        logger.debug({ videoId, alreadyNotified, suppressedByQuiet, suppressedByCooldown }, 'Suppressing YouTube video announcement');
                        continue;
                    }

                    const embed = new EmbedBuilder()
                        .setColor(0xff0000)
                        .setTitle(video.title ?? null)
                        .setURL(video.link ?? null)
                        .setAuthor({ name: video.author ?? 'Unknown', url: `https://youtube.com/channel/${ytChannel.youtubeChannelId}` })
                        .setTimestamp(new Date(video.published ?? Date.now()));

                    const thumb = getYoutubeThumbnailUrl(video);
                    if (thumb) embed.setImage(thumb);

                    const details = detailsById.get(videoId) ?? null;
                    if (details?.duration) {
                        const pretty = formatYoutubeDuration(details.duration);
                        if (pretty) embed.addFields({ name: 'Duration', value: pretty, inline: true });
                    }
                    if (details?.viewCount) {
                        embed.addFields({ name: 'Views', value: details.viewCount, inline: true });
                    }

                    const watchButton = new ButtonBuilder().setLabel('Watch Video').setStyle(ButtonStyle.Link).setURL(video.link ?? 'https://youtube.com');
                    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(watchButton);
                    const url = video.link ?? (videoId ? `https://www.youtube.com/watch?v=${videoId}` : 'https://youtube.com');
                    const tokens = {
                        title: video.title ?? '',
                        channel: video.author ?? 'Unknown',
                        url,
                        duration: details?.duration ? (formatYoutubeDuration(details.duration) ?? '') : '',
                        views: details?.viewCount ?? '',
                    };
                    let message: string;
                    if (ytChannel.customMessage) {
                        const tmpl = String(ytChannel.customMessage);
                        message = renderTemplate(tmpl, tokens);
                        if (!tmpl.includes('{url}')) {
                            message = `${message}\n${url}`;
                        }
                    } else {
                        message = `Hey @everyone, new video from ${video.author ?? 'Unknown'}: ${url}`;
                    }

                    await (discordChannel as TextChannel).send({ content: message, embeds: [embed], components: [row] });
                    logger.info({ guildId: (discordChannel as any)?.guild?.id, discordChannelId: ytChannel.discordChannelId, videoId }, 'Announced YouTube video');
                    sentAny = true;

                    await notifications.recordIfNew({
                        provider: 'youtube',
                        eventId: videoId,
                        channelId: ytChannel.discordChannelId,
                        guildId: (discordChannel as any)?.guild?.id,
                    });
                }

                ytChannel.lastVideoId = newVideos[0]['yt:videoId'] ?? ytChannel.lastVideoId;
                if (sentAny) (ytChannel as any).lastNotifiedAt = now;
                await ytChannel.save();
            } catch (err) {
                logger.error({ err, idx, youtubeChannelId: (ytChannel as any)?.youtubeChannelId }, 'Error in checkAndAnnounceNewVideos per-channel task');
            }
        }),
    );
}
