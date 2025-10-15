import axios from 'axios';
import Parser from 'rss-parser';
import {
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    ChannelType,
    Client,
    EmbedBuilder,
    TextChannel
} from 'discord.js';
import {getConfigManager} from '@zeffuro/fakegaming-common/managers';
import {isWithinQuietHours} from '@zeffuro/fakegaming-common/utils';

// Define a minimal shape for RSS items we access to satisfy strict typing
type MediaThumbnailNode = { $?: { url?: string }; url?: string };

type YoutubeFeedItem = {
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
};

const apiKey = process.env.YOUTUBE_API_KEY!;
const _liveStatus: Record<string, boolean> = {};
void _liveStatus;

const parser = new Parser({
    customFields: {
        item: [
            'yt:videoId',
            'author',
            'published',
            'title',
            ['media:group', 'mediaGroup', {keepArray: false}],
            ['media:community', 'mediaCommunity', {keepArray: false}],
            ['media:thumbnail', 'mediaThumbnail', {keepArray: false}],
            ['media:description', 'mediaDescription', {keepArray: false}],
            ['media:statistics', 'mediaStatistics', {keepArray: false}],
            ['media:starRating', 'mediaStarRating', {keepArray: false}]
        ]
    }
});

/**
 * Resolve a thumbnail URL for a YouTube video feed item.
 * Prefers the URL provided by the feed; falls back to i.ytimg.com using the videoId.
 */
function getYoutubeThumbnailUrl(item: YoutubeFeedItem): string | null {
    // Prefer the nested media:group thumbnail if present
    const group = item.mediaGroup as YoutubeFeedItem['mediaGroup'] | undefined;
    const fromGroupRaw = group?.['media:thumbnail'] ?? group?.mediaThumbnail;
    const fromGroup: MediaThumbnailNode | null = Array.isArray(fromGroupRaw) ? (fromGroupRaw[0] ?? null) : (fromGroupRaw ?? null);
    const fromGroupUrl = fromGroup?.$?.url ?? fromGroup?.url;

    if (fromGroupUrl?.startsWith('http')) {
        return fromGroupUrl;
    }

    // Then try any top-level media:thumbnail mapping
    const fromFeed = item.mediaThumbnail?.$.url;
    if (fromFeed?.startsWith('http')) {
        return fromFeed;
    }

    // Finally, build a reliable fallback from videoId
    const id = item['yt:videoId'];
    if (id && /^[-_a-zA-Z0-9]{6,}$/.test(id)) {
        return `https://i.ytimg.com/vi/${id}/hqdefault.jpg`;
    }
    return null;
}


/**
 * Resolve a YouTube channel identifier (handle like @name, legacy username, or channelId) to a channelId.
 * - If a channelId is provided, validate it by ensuring the feed returns items.
 * - If a handle ("@foo") is provided, uses YouTube Data API v3 `forHandle`.
 * - Otherwise treats the identifier as a legacy `forUsername`.
 *
 * @param identifier The user-supplied YouTube identifier.
 * @returns The resolved channelId (e.g., "UC...") or null if not found/invalid.
 */
export async function getYoutubeChannelId(identifier: string): Promise<string | null> {
    const isChannelId = /^UC[\w-]{22}$/.test(identifier);
    const isHandle = identifier.startsWith('@');

    let url = 'https://www.googleapis.com/youtube/v3';

    if (isChannelId) {
        const feed = await getYoutubeChannelFeed(identifier);
        if (feed) {
            return identifier;
        } else {
            return null;
        }
    } else if (isHandle) {
        const handle = identifier.substring(1);
        url = `${url}/channels?part=id&forHandle=${encodeURIComponent(handle)}&key=${apiKey}`;
    } else {
        url = `${url}/channels?part=id&forUsername=${encodeURIComponent(identifier)}&key=${apiKey}`;
    }

    try {
        const res = await axios.get(url);
        return res.data.items?.[0]?.id ?? null;
    } catch (error) {
        if (error instanceof Error) {
            console.error("Error fetching YouTube channel ID:", error.message);
        } else {
            console.error("Error fetching YouTube channel ID:", error);
        }
        return null;
    }
}

/**
 * Fetch and parse the RSS feed for a YouTube channel.
 * @param channelId The channelId (starts with "UC").
 * @returns The list of feed items or null when empty or on parse errors.
 */
export async function getYoutubeChannelFeed(channelId: string): Promise<YoutubeFeedItem[] | null> {
    const feedUrl = `https://www.youtube.com/feeds/videos.xml?channel_id=${encodeURIComponent(channelId)}`;
    try {
        const feed = await parser.parseURL(feedUrl);
        if (!feed.items || feed.items.length === 0) {
            return null;
        }
        return feed.items as YoutubeFeedItem[];
    } catch (error) {
        if (error instanceof Error) {
            console.error("Error fetching YouTube channel feed:", error.message);
        } else {
            console.error("Error fetching YouTube channel feed:", error);
        }
        return null;
    }
}

/**
 * Poll configured YouTube channels and announce new videos to their Discord channels.
 * Uses the Notifications manager to deduplicate by videoId across restarts.
 *
 * Update rule for lastVideoId:
 * - When prior lastVideoId is present, announce items strictly newer than it, oldest-first.
 * - Persist lastVideoId to the oldest newly-announced item to avoid reprocessing.
 *
 * @param client The Discord client used to send messages.
 */
export async function checkAndAnnounceNewVideos(client: Client): Promise<void> {
    const youtubeManager = getConfigManager().youtubeManager;
    const notifications = getConfigManager().notificationsManager;
    const channels = await youtubeManager.getAllChannels();

    if (!channels || channels.length === 0) return;

    await Promise.all(channels.map(async (ytChannel) => {
        if (!ytChannel.youtubeChannelId || !ytChannel.discordChannelId) return;

        const feedItems = await getYoutubeChannelFeed(ytChannel.youtubeChannelId);
        if (!feedItems || feedItems.length === 0) return;

        let newVideos: YoutubeFeedItem[];
        if (ytChannel.lastVideoId) {
            const idx = feedItems.findIndex(item => item['yt:videoId'] === ytChannel.lastVideoId);
            newVideos = idx === 0 ? [] : idx > 0 ? feedItems.slice(0, idx).reverse() : [feedItems[0]];
        } else {
            newVideos = [feedItems[0]];
        }

        if (newVideos.length === 0) return;

        const discordChannel = client.channels.cache.get(ytChannel.discordChannelId);
        if (
            discordChannel &&
            (discordChannel.type === ChannelType.GuildText ||
                discordChannel.type === ChannelType.GuildAnnouncement)
        ) {
            const now = new Date();
            const suppressedByQuiet = isWithinQuietHours(
                (ytChannel as any).quietHoursStart ?? null,
                (ytChannel as any).quietHoursEnd ?? null,
                now
            );

            const cooldownMinutes = (ytChannel as any).cooldownMinutes as number | null | undefined;
            const lastNotifiedAt = (ytChannel as any).lastNotifiedAt as Date | string | null | undefined;
            const lastNotifiedDate = lastNotifiedAt ? new Date(lastNotifiedAt) : null;
            const suppressedByCooldown = typeof cooldownMinutes === 'number' && cooldownMinutes > 0 && lastNotifiedDate
                ? (now.getTime() - lastNotifiedDate.getTime()) < cooldownMinutes * 60_000
                : false;

            let sentAny = false;

            for (const video of newVideos) {
                const videoId = video['yt:videoId'];
                if (!videoId) continue;

                // respect dedupe
                const alreadyNotified = await notifications.has('youtube', videoId);

                if (alreadyNotified || suppressedByQuiet || suppressedByCooldown) {
                    // Skip sending; do not create notification record. We'll still advance lastVideoId below.
                    continue;
                }

                const embed = new EmbedBuilder()
                    .setColor(0xff0000)
                    .setTitle(video.title ?? null)
                    .setURL(video.link ?? null)
                    .setAuthor({
                        name: video.author ?? 'Unknown',
                        url: `https://youtube.com/channel/${ytChannel.youtubeChannelId}`
                    })
                    .setTimestamp(new Date(video.published ?? Date.now()));

                const thumb = getYoutubeThumbnailUrl(video);
                if (thumb) {
                    embed.setImage(thumb);
                }

                const watchButton = new ButtonBuilder()
                    .setLabel('Watch Video')
                    .setStyle(ButtonStyle.Link)
                    .setURL(video.link ?? 'https://youtube.com');

                const row = new ActionRowBuilder<ButtonBuilder>().addComponents(watchButton);
                const message = ytChannel.customMessage
                    ? ytChannel.customMessage.replace('{title}', video.title ?? 'New Video') + '\n' + (video.link ?? '')
                    : `Hey @everyone, new video from ${video.author ?? 'Unknown'}: ${video.link ?? ''}`;

                await (discordChannel as TextChannel).send({ content: message, embeds: [embed], components: [row] });
                sentAny = true;

                await notifications.recordIfNew({
                    provider: 'youtube',
                    eventId: videoId,
                    channelId: ytChannel.discordChannelId,
                    guildId: (discordChannel as any)?.guild?.id
                });
            }

            ytChannel.lastVideoId = newVideos[0]['yt:videoId'] ?? ytChannel.lastVideoId;
            if (sentAny) {
                (ytChannel as any).lastNotifiedAt = now;
            }
            await ytChannel.save();
        }
    }));
}