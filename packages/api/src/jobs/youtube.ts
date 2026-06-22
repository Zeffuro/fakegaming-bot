import Parser from 'rss-parser';
import { getLogger } from '@zeffuro/fakegaming-common';
import { getConfigManager } from '@zeffuro/fakegaming-common/managers';
import type { JobQueue } from '@zeffuro/fakegaming-common/jobs';
import { fetchYouTubeChannelPageLatestVideo, getHttpStatusFromError } from '../utils/youtubePublic.js';
import { getNotificationSuppression } from './notificationSuppression.js';
import { buildDiscordNotificationPayload } from './discordNotificationPayload.js';
import { upsertOrSaveJobConfig } from './jobConfigPersistence.js';
import { hasRecordedJobNotification, sendJobNotification, type JobNotificationManager } from './jobNotifications.js';
import { registerRecurringPollingJob } from './recurringPollingJob.js';
import { recordIntegrationFailure, recordIntegrationSuccess } from './integrationHealth.js';

interface YoutubeChannelConfigPlain {
    id?: number | string;
    guildId: string;
    discordChannelId: string;
    youtubeChannelId: string;
    lastVideoId?: string | null;
    customMessage?: string | null;
    quietHoursStart?: string | null;
    quietHoursEnd?: string | null;
    cooldownMinutes?: number | null;
    lastNotifiedAt?: string | number | Date | null;
    paused?: boolean | null;
}

interface YoutubeFeedItem {
    ['yt:videoId']?: string;
    title?: string;
    link?: string;
    author?: string;
    published?: string;
    mediaThumbnail?: { $?: { url?: string } };
    mediaGroup?: {
        ['media:thumbnail']?: any;
        mediaThumbnail?: any;
    };
}

interface YoutubeVideoDetails { duration?: string; viewCount?: string }

interface YoutubeSendPlan {
    cfg: YoutubeChannelConfigPlain;
    channelId: string;
    newVideos: YoutubeFeedItem[];
    sendVideos: YoutubeFeedItem[];
    now: Date;
}

const parser = new Parser({
    customFields: {
        item: [
            'yt:videoId',
            'author',
            'published',
            'title',
            ['media:group', 'mediaGroup', { keepArray: false }],
            ['media:thumbnail', 'mediaThumbnail', { keepArray: false }],
        ]
    }
});

function getYoutubeApiKey(): string | null {
    const key = process.env.YOUTUBE_API_KEY;
    return key && key.length > 0 ? key : null;
}

function shouldEnrich(): boolean {
    return process.env.YOUTUBE_ENRICH_EMBEDS === '1' || process.env.YOUTUBE_ENRICH_EMBEDS === 'true';
}

function getYoutubeThumbnailUrl(item: YoutubeFeedItem): string | null {
    const group = item.mediaGroup;
    const fromGroupRaw = (group as any)?.['media:thumbnail'] ?? (group as any)?.mediaThumbnail;
    const node: any = Array.isArray(fromGroupRaw) ? (fromGroupRaw[0] ?? null) : (fromGroupRaw ?? null);
    const fromGroupUrl = node?.$?.url ?? node?.url;
    if (fromGroupUrl && String(fromGroupUrl).startsWith('http')) return String(fromGroupUrl);
    const fromFeed = (item as any).mediaThumbnail?.$?.url;
    if (fromFeed && String(fromFeed).startsWith('http')) return String(fromFeed);
    const id = item['yt:videoId'];
    if (id && /^[-_a-zA-Z0-9]{6,}$/.test(id)) return `https://i.ytimg.com/vi/${id}/hqdefault.jpg`;
    return null;
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

async function fetchYoutubeChannelFeed(channelId: string, log = getLogger({ name: 'api:jobs:youtube' })): Promise<YoutubeFeedItem[] | null> {
    const url = `https://www.youtube.com/feeds/videos.xml?channel_id=${encodeURIComponent(channelId)}`;
    try {
        const feed = await parser.parseURL(url);
        const items = (feed.items ?? []) as unknown as YoutubeFeedItem[];
        return items.length > 0 ? items : null;
    } catch (err) {
        const statusCode = getHttpStatusFromError(err);
        try {
            const fallback = await fetchYouTubeChannelPageLatestVideo(channelId);
            if (fallback) {
                log.debug({ channelId, statusCode }, 'Using YouTube channel page fallback after feed fetch failed');
                return [{
                    'yt:videoId': fallback.videoId,
                    title: fallback.title ?? undefined,
                    link: fallback.link,
                    author: fallback.author ?? undefined,
                    published: new Date().toISOString(),
                }];
            }
        } catch (fallbackErr) {
            log.debug({ err: fallbackErr, channelId }, 'Failed to fetch YouTube channel page fallback');
        }

        if (statusCode) {
            log.warn({ channelId, statusCode }, 'YouTube channel feed unavailable and page fallback found no videos');
        } else {
            log.error({ err, channelId }, 'Failed to fetch YouTube channel feed');
        }
        return null;
    }
}

async function fetchYoutubeVideoDetailsBatch(videoIds: string[], log = getLogger({ name: 'api:jobs:youtube' })): Promise<Map<string, YoutubeVideoDetails>> {
    const out = new Map<string, YoutubeVideoDetails>();
    const apiKey = getYoutubeApiKey();
    if (!shouldEnrich() || !apiKey) return out;
    const ids = Array.from(new Set(videoIds)).filter((v) => v.length > 0);
    if (ids.length === 0) return out;
    const chunkSize = 50;
    for (let i = 0; i < ids.length; i += chunkSize) {
        const chunk = ids.slice(i, i + chunkSize);
        try {
            const url = `https://www.googleapis.com/youtube/v3/videos?part=contentDetails,statistics&id=${encodeURIComponent(chunk.join(','))}&key=${apiKey}`;
            const res = await fetch(url);
            if (!res.ok) continue;
            const data = await res.json();
            const items = (data?.items ?? []) as any[];
            for (const item of items) {
                const id = String(item.id ?? '');
                if (!id) continue;
                out.set(id, { duration: item.contentDetails?.duration, viewCount: item.statistics?.viewCount });
            }
        } catch (err) {
            log.debug({ err, chunkSize: chunk.length }, 'Failed to fetch YouTube video details chunk');
        }
    }
    return out;
}

function buildYoutubeEmbedPayload(item: YoutubeFeedItem, channelId: string, details?: YoutubeVideoDetails | null, customMessage?: string | null): { content: string; payload: Record<string, unknown> } {
    const videoId = item['yt:videoId'] ?? '';
    const url = item.link ?? (videoId ? `https://www.youtube.com/watch?v=${videoId}` : 'https://youtube.com');
    const urlSafe = `<${url}>`;
    const author = item.author ?? 'Unknown';
    const title = item.title ?? null;
    const publishedIso = item.published ? new Date(item.published).toISOString() : new Date().toISOString();
    const thumb = getYoutubeThumbnailUrl(item);

    const embed: Record<string, unknown> = {
        title,
        url,
        author: { name: author, url: `https://youtube.com/channel/${channelId}` },
        timestamp: publishedIso,
        color: 0xff0000
    };
    if (thumb) (embed as any).image = { url: thumb };
    const fields: Array<{ name: string; value: string; inline?: boolean }> = [];
    if (details?.duration) {
        const pretty = formatYoutubeDuration(details.duration);
        if (pretty) fields.push({ name: 'Duration', value: pretty, inline: true });
    }
    if (details?.viewCount) {
        fields.push({ name: 'Views', value: details.viewCount, inline: true });
    }
    if (fields.length > 0) (embed as any).fields = fields;

    const tokens = {
        title: item.title ?? '',
        channel: author,
        url: urlSafe,
        duration: details?.duration ? (formatYoutubeDuration(details.duration) ?? '') : '',
        views: details?.viewCount ?? ''
    };
    return buildDiscordNotificationPayload({
        defaultContent: `Hey @everyone, new video from ${author}: ${urlSafe}`,
        embed,
        buttonLabel: 'Watch Video',
        buttonUrl: url,
        tokens,
        customMessage,
        urlToken: urlSafe,
    });
}

async function processYoutubePoll(log = getLogger({ name: 'api:jobs:youtube' })): Promise<{ processed: number; errors: number }> {
    const cm = getConfigManager();
    const manager = cm.youtubeManager as unknown as {
        getAllChannels: () => Promise<YoutubeChannelConfigPlain[]>;
        upsert?: (item: YoutubeChannelConfigPlain, fields: string[]) => Promise<unknown>;
    };
    const notifications = cm.notificationsManager as unknown as JobNotificationManager;

    const channels = (await manager.getAllChannels()).filter(cfg => !cfg.paused);
    if (!channels.length) return { processed: 0, errors: 0 };

    let processed = 0; let errors = 0;
    const channelsById = new Map<string, YoutubeChannelConfigPlain[]>();

    for (const cfg of channels) {
        if (!cfg.youtubeChannelId || !cfg.discordChannelId) continue;
        const channelId = cfg.youtubeChannelId.trim();
        const group = channelsById.get(channelId) ?? [];
        group.push(cfg);
        channelsById.set(channelId, group);
    }

    const plans: YoutubeSendPlan[] = [];

    for (const [channelId, configs] of channelsById) {
        const feedItems = await fetchYoutubeChannelFeed(channelId, log);
        if (!feedItems || feedItems.length === 0) {
            errors += configs.length;
            await Promise.all(configs.map(cfg => recordIntegrationFailure('youtube', cfg, new Error(`YouTube feed unavailable for channel ${channelId}`), {
                errorCode: 'YOUTUBE_FEED_UNAVAILABLE',
                metadata: { youtubeChannelId: channelId },
            })));
            continue;
        }

        for (const cfg of configs) {
            try {
                let newVideos: YoutubeFeedItem[];
                if (cfg.lastVideoId) {
                    const idxLast = feedItems.findIndex((it) => it['yt:videoId'] === cfg.lastVideoId);
                    newVideos = idxLast === 0 ? [] : idxLast > 0 ? feedItems.slice(0, idxLast).reverse() : [feedItems[0]];
                } else {
                    newVideos = [feedItems[0]];
                }
                if (newVideos.length === 0) {
                    await recordIntegrationSuccess('youtube', cfg, {
                        metadata: {
                            youtubeChannelId: channelId,
                            latestVideoId: cfg.lastVideoId ?? feedItems[0]?.['yt:videoId'] ?? null,
                            newVideos: 0,
                        },
                    });
                    continue;
                }

                const now = new Date();
                const suppression = getNotificationSuppression(cfg, now);
                const sendVideos: YoutubeFeedItem[] = [];

                for (const video of newVideos) {
                    const videoId = video['yt:videoId'];
                    if (!videoId) continue;
                    // Use per-guild deduplication so the same YouTube video can be announced in multiple guilds
                    const already = await hasRecordedJobNotification(notifications, 'youtube', videoId, cfg.guildId);
                    if (already || suppression.shouldSuppress) {
                        log.debug({
                            videoId,
                            already,
                            suppressedByQuiet: suppression.suppressedByQuiet,
                            suppressedByCooldown: suppression.suppressedByCooldown,
                        }, 'Suppressing YouTube video announcement');
                        continue;
                    }
                    sendVideos.push(video);
                }

                plans.push({ cfg, channelId, newVideos, sendVideos, now });
            } catch (err) {
                errors += 1;
                await recordIntegrationFailure('youtube', cfg, err, {
                    metadata: { youtubeChannelId: cfg.youtubeChannelId },
                });
                log.error({ err, youtubeChannelId: cfg.youtubeChannelId }, 'Error processing YouTube channel');
            }
        }
    }

    const detailsById = await fetchYoutubeVideoDetailsBatch(plans.flatMap(plan => plan.sendVideos.map(v => v['yt:videoId']).filter((v): v is string => !!v)), log);

    for (const plan of plans) {
        const { cfg, channelId, newVideos, sendVideos, now } = plan;
        try {
            let sentAny = false;

            for (const video of sendVideos) {
                const videoId = video['yt:videoId'];
                if (!videoId) continue;
                const details = detailsById.get(videoId) ?? null;
                const built = buildYoutubeEmbedPayload(video, channelId, details, cfg.customMessage ?? null);
                const sent = await sendJobNotification({
                    manager: notifications,
                    provider: 'youtube',
                    eventId: videoId,
                    channelId: cfg.discordChannelId,
                    guildId: cfg.guildId,
                    payload: built.payload,
                });
                if (sent) {
                    sentAny = true;
                    processed += 1;
                }
            }

            cfg.lastVideoId = newVideos.at(-1)?.['yt:videoId'] ?? cfg.lastVideoId ?? null;
            if (sentAny) cfg.lastNotifiedAt = now;
            await upsertOrSaveJobConfig(manager, cfg);
            await recordIntegrationSuccess('youtube', cfg, {
                delivered: sentAny,
                checkedAt: now,
                metadata: {
                    youtubeChannelId: channelId,
                    latestVideoId: cfg.lastVideoId ?? null,
                    newVideos: newVideos.length,
                    sentVideos: sendVideos.length,
                },
            });
        } catch (err) {
            errors += 1;
            await recordIntegrationFailure('youtube', cfg, err, {
                metadata: { youtubeChannelId: cfg.youtubeChannelId },
            });
            log.error({ err, youtubeChannelId: cfg.youtubeChannelId }, 'Error processing YouTube channel');
        }
    }

    return { processed, errors };
}

/**
 * Register YouTube polling job.
 * - Polls every ~5 minutes with singleton scheduling.
 */
export async function registerYouTubeJobs(queue: JobQueue, now: Date = new Date()): Promise<void> {
    const log = getLogger({ name: 'api:jobs:youtube' });

    await registerRecurringPollingJob({
        queue,
        provider: 'youtube',
        jobName: 'youtube:poll',
        intervalSeconds: 300,
        initialDelaySeconds: 5,
        now,
        run: () => processYoutubePoll(log),
    });

    log.info('Scheduled YouTube polling job');
}
