import Parser from 'rss-parser';
import { getLogger } from '@zeffuro/fakegaming-common';
import { getConfigManager } from '@zeffuro/fakegaming-common/managers';
import type { JobQueue } from '@zeffuro/fakegaming-common/jobs';
import { scheduleSingleton, formatMinuteKey } from '@zeffuro/fakegaming-common/jobs';
import { isWithinQuietHours } from '@zeffuro/fakegaming-common/utils';
import { renderTemplate } from '@zeffuro/fakegaming-common/utils';
import { sendChannelMessagePayload } from '../utils/discord.js';
import { recordJobRun } from './status.js';

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
        log.error({ err, channelId }, 'Failed to fetch YouTube channel feed');
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
    let content = `Hey @everyone, new video from ${author}: ${urlSafe}`;
    if (customMessage) {
        const tmpl = String(customMessage);
        content = renderTemplate(tmpl, tokens);
        if (!tmpl.includes('{url}')) content = `${content}\n${urlSafe}`;
    }
    return { content, payload: { content, embeds: [embed], components: [{ type: 1, components: [{ type: 2, style: 5, label: 'Watch Video', url }] }] } };
}

async function processYoutubePoll(log = getLogger({ name: 'api:jobs:youtube' })): Promise<{ processed: number; errors: number }> {
    const cm = getConfigManager();
    const manager = cm.youtubeManager as unknown as { getAllChannels: () => Promise<YoutubeChannelConfigPlain[]> };
    const notifications = cm.notificationsManager as unknown as { has: (p: string, id: string) => Promise<boolean>; recordIfNew: (x: { provider: string; eventId: string; channelId: string; guildId: string }) => Promise<void> };

    const channels = await manager.getAllChannels();
    if (!channels.length) return { processed: 0, errors: 0 };

    let processed = 0; let errors = 0;

    for (const cfg of channels) {
        try {
            if (!cfg.youtubeChannelId || !cfg.discordChannelId) continue;
            const feedItems = await fetchYoutubeChannelFeed(cfg.youtubeChannelId, log);
            if (!feedItems || feedItems.length === 0) continue;

            let newVideos: YoutubeFeedItem[];
            if (cfg.lastVideoId) {
                const idxLast = feedItems.findIndex((it) => it['yt:videoId'] === cfg.lastVideoId);
                newVideos = idxLast === 0 ? [] : idxLast > 0 ? feedItems.slice(0, idxLast).reverse() : [feedItems[0]];
            } else {
                newVideos = [feedItems[0]];
            }
            if (newVideos.length === 0) continue;

            const now = new Date();
            const suppressedByQuiet = isWithinQuietHours(cfg.quietHoursStart ?? null, cfg.quietHoursEnd ?? null, now);
            const lastNotifiedDate = cfg.lastNotifiedAt ? new Date(cfg.lastNotifiedAt) : null;
            const suppressedByCooldown = typeof cfg.cooldownMinutes === 'number' && cfg.cooldownMinutes > 0 && lastNotifiedDate
                ? now.getTime() - lastNotifiedDate.getTime() < cfg.cooldownMinutes * 60_000
                : false;

            const detailsById = !suppressedByQuiet && !suppressedByCooldown
                ? await fetchYoutubeVideoDetailsBatch(newVideos.map(v => v['yt:videoId']).filter((v): v is string => !!v))
                : new Map<string, YoutubeVideoDetails>();

            let sentAny = false;

            for (const video of newVideos) {
                const videoId = video['yt:videoId'];
                if (!videoId) continue;
                const already = await notifications.has('youtube', videoId);
                if (already || suppressedByQuiet || suppressedByCooldown) {
                    log.debug({ videoId, already, suppressedByQuiet, suppressedByCooldown }, 'Suppressing YouTube video announcement');
                    continue;
                }
                const details = detailsById.get(videoId) ?? null;
                const built = buildYoutubeEmbedPayload(video, cfg.youtubeChannelId, details, cfg.customMessage ?? null);
                const sent = await sendChannelMessagePayload(cfg.discordChannelId, built.payload);
                if (sent && typeof (sent as any).id === 'string') {
                    sentAny = true;
                    await notifications.recordIfNew({ provider: 'youtube', eventId: videoId, channelId: cfg.discordChannelId, guildId: cfg.guildId });
                    processed += 1;
                }
            }

            cfg.lastVideoId = newVideos[0]['yt:videoId'] ?? cfg.lastVideoId ?? null;
            if (sentAny) cfg.lastNotifiedAt = now;
            await (cm.youtubeManager as any).upsert?.(cfg, ['id'])?.catch(async () => { await (cfg as any).save?.(); });
        } catch (err) {
            errors += 1;
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

    queue.on('youtube:poll', async (job) => {
        const startedAt = new Date().toISOString();
        try {
            const { processed, errors } = await processYoutubePoll(log);
            const delaySec = 300;
            const nextAt = new Date(Date.now() + delaySec * 1000);
            const key = `youtube:next:${formatMinuteKey(nextAt)}`;
            await scheduleSingleton(queue, 'youtube:poll', {}, delaySec, key);
            recordJobRun('youtube', { startedAt, finishedAt: new Date().toISOString(), ok: errors === 0, meta: { processed, errors } });
        } catch (err) {
            recordJobRun('youtube', { startedAt, finishedAt: new Date().toISOString(), ok: false, error: err instanceof Error ? err.message : 'Unknown error' });
        } finally {
            await job.done();
        }
    });

    // Schedule initial and immediate run
    const initDelay = 5; // seconds
    await scheduleSingleton(queue, 'youtube:poll', {}, initDelay, `youtube:init:${formatMinuteKey(new Date(now.getTime() + initDelay * 1000))}`);
    await scheduleSingleton(queue, 'youtube:poll', {}, 0, `youtube:catchup:${formatMinuteKey(now)}`);

    log.info('Scheduled YouTube polling job');
}
