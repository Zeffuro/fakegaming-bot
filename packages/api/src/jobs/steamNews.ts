import { Op } from 'sequelize';
import { getLogger, JobRun } from '@zeffuro/fakegaming-common';
import { getConfigManager, type SteamNewsSubscriptionManager } from '@zeffuro/fakegaming-common/managers';
import type { JobQueue } from '@zeffuro/fakegaming-common/jobs';
import { formatMinuteKey, scheduleSingleton } from '@zeffuro/fakegaming-common/jobs';
import { getSteamAppById } from '@zeffuro/fakegaming-common/steam';
import { getNotificationSuppression } from './notificationSuppression.js';
import { hasRecordedJobNotification, sendJobNotification, type JobNotificationManager } from './jobNotifications.js';
import { recordIntegrationFailure, recordIntegrationSuccess } from './integrationHealth.js';
import { recordJobRun } from './status.js';

const STEAM_NEWS_PROVIDER = 'steamnews';
const STEAM_NEWS_FEED = 'steam_community_announcements';
const STEAM_NEWS_RUN_NAME = 'steamnews';
const MIN_STEAM_NEWS_POLL_INTERVAL_SECONDS = 20 * 60;

export interface SteamNewsItem {
    gid: string;
    title: string;
    url: string;
    contents?: string;
    date: number;
    feedlabel?: string;
    feedname?: string;
    author?: string;
    appid?: number;
}

interface SteamNewsSubscriptionPlain {
    id: number | string;
    steamAppId: number;
    appName?: string | null;
    discordChannelId: string;
    guildId: string;
    lastNewsGid?: string | null;
    lastAnnouncedAt?: number | string | Date | null;
    customMessage?: string | null;
    cooldownMinutes?: number | null;
    quietHoursStart?: string | null;
    quietHoursEnd?: string | null;
    paused?: boolean | null;
}

interface SteamNewsApiResponse {
    appnews?: {
        appid?: number;
        newsitems?: SteamNewsItem[];
    };
}

export function computeNextSteamNewsDelaySeconds(): number {
    const base = 30 * 60;
    const jitter = Math.floor((Math.random() * 600) - 300);
    return Math.max(300, base + jitter);
}

export async function fetchSteamNewsForApp(appId: number, count = 5): Promise<SteamNewsItem[]> {
    const params = new URLSearchParams({
        appid: String(appId),
        count: String(count),
        maxlength: '500',
        feeds: STEAM_NEWS_FEED,
        format: 'json',
    });
    const response = await fetch(`https://api.steampowered.com/ISteamNews/GetNewsForApp/v2/?${params.toString()}`);
    if (!response.ok) {
        throw new Error(`Steam news request failed with status ${response.status}`);
    }

    const data = await response.json() as SteamNewsApiResponse;
    const items = data.appnews?.newsitems;
    if (!Array.isArray(items)) return [];

    return items
        .filter((item) => typeof item.gid === 'string' && typeof item.title === 'string' && typeof item.url === 'string')
        .sort((a, b) => a.date - b.date);
}

export function buildSteamNewsEmbedPayload(subscription: SteamNewsSubscriptionPlain, item: SteamNewsItem, imageUrl?: string | null): Record<string, unknown> {
    const appName = subscription.appName?.trim() || `Steam app ${subscription.steamAppId}`;
    const description = formatSteamNewsDescription(item.contents);
    const embed: Record<string, unknown> = {
        title: item.title,
        url: item.url,
        description,
        color: 0x66C0F4,
        timestamp: new Date(item.date * 1000).toISOString(),
        author: {
            name: appName,
        },
        footer: {
            text: item.feedlabel || 'Steam News',
        },
        ...(imageUrl ? { image: { url: imageUrl } } : {}),
    };

    return {
        ...(subscription.customMessage ? { content: subscription.customMessage } : {}),
        embeds: [embed],
    };
}

async function processSteamNewsSubscriptions(log = getLogger({ name: 'api:jobs:steamnews' })): Promise<{ processed: number; checked: number; errors: number }> {
    const cm = getConfigManager();
    const subscriptions = await cm.steamNewsSubscriptionManager.getActiveSubscriptions() as unknown as SteamNewsSubscriptionPlain[];
    const notifications = cm.notificationsManager as unknown as JobNotificationManager;
    let processed = 0;
    let checked = 0;
    let errors = 0;

    for (const subscription of subscriptions) {
        checked += 1;
        try {
            const enrichedSubscription = await enrichSteamNewsSubscription(subscription, log);
            const items = await fetchSteamNewsForApp(enrichedSubscription.steamAppId);
            const nextItem = selectNextSteamNewsItem(items, subscription.lastNewsGid, subscription.lastAnnouncedAt);
            if (!nextItem) {
                await recordIntegrationSuccess(STEAM_NEWS_PROVIDER, enrichedSubscription, {
                    metadata: {
                        steamAppId: enrichedSubscription.steamAppId,
                        appName: enrichedSubscription.appName ?? null,
                    },
                });
                continue;
            }

            const suppression = getNotificationSuppression({
                ...enrichedSubscription,
                lastNotifiedAt: enrichedSubscription.lastAnnouncedAt ?? null,
            }, new Date());

            if (suppression.shouldSuppress) {
                await recordIntegrationSuccess(STEAM_NEWS_PROVIDER, {
                    ...enrichedSubscription,
                    lastNotifiedAt: enrichedSubscription.lastAnnouncedAt ?? null,
                }, {
                    metadata: {
                        steamAppId: enrichedSubscription.steamAppId,
                        suppressedByQuiet: suppression.suppressedByQuiet,
                        suppressedByCooldown: suppression.suppressedByCooldown,
                    },
                });
                continue;
            }

            const eventId = buildSteamNewsEventId(enrichedSubscription, nextItem);
            const alreadyAnnounced = await hasRecordedJobNotification(notifications, STEAM_NEWS_PROVIDER, eventId, enrichedSubscription.guildId);
            if (alreadyAnnounced) {
                await updateSteamNewsCursor(cm.steamNewsSubscriptionManager, enrichedSubscription, nextItem);
                await recordIntegrationSuccess(STEAM_NEWS_PROVIDER, enrichedSubscription, {
                    metadata: {
                        steamAppId: enrichedSubscription.steamAppId,
                        appName: enrichedSubscription.appName ?? null,
                        newsGid: nextItem.gid,
                        skippedDuplicate: true,
                    },
                });
                continue;
            }

            const imageUrl = await fetchSteamNewsImageUrl(nextItem).catch((err: unknown) => {
                log.debug({ err, newsUrl: nextItem.url }, 'Failed to fetch Steam news image metadata');
                return null;
            });
            const sent = await sendJobNotification({
                manager: notifications,
                provider: STEAM_NEWS_PROVIDER,
                eventId,
                channelId: enrichedSubscription.discordChannelId,
                guildId: enrichedSubscription.guildId,
                payload: buildSteamNewsEmbedPayload(enrichedSubscription, nextItem, imageUrl),
            });

            if (!sent) {
                throw new Error('Discord send returned no message id');
            }

            await updateSteamNewsCursor(cm.steamNewsSubscriptionManager, enrichedSubscription, nextItem);
            processed += 1;
            await recordIntegrationSuccess(STEAM_NEWS_PROVIDER, enrichedSubscription, {
                delivered: true,
                metadata: {
                    steamAppId: enrichedSubscription.steamAppId,
                    appName: enrichedSubscription.appName ?? null,
                    newsGid: nextItem.gid,
                    newsUrl: nextItem.url,
                    imageUrl,
                },
            });
        } catch (err) {
            errors += 1;
            await recordIntegrationFailure(STEAM_NEWS_PROVIDER, subscription, err, {
                errorCode: 'STEAM_NEWS_POLL_FAILED',
                metadata: {
                    steamAppId: subscription.steamAppId,
                    appName: subscription.appName ?? null,
                },
            });
            log.error({ err, steamAppId: subscription.steamAppId, subscriptionId: subscription.id }, 'Failed to process Steam news subscription');
        }
    }

    return { processed, checked, errors };
}

export async function fetchSteamNewsImageUrl(item: SteamNewsItem, fetchImpl: typeof fetch = fetch): Promise<string | null> {
    const contentImage = extractSteamNewsImageUrl(item.contents ?? '');
    if (contentImage) return contentImage;

    if (!isHttpUrl(item.url)) return null;
    const response = await fetchImpl(item.url);
    if (!response.ok) return null;

    const html = await response.text();
    return extractSteamNewsImageUrl(html);
}

export function extractSteamNewsImageUrl(value: string): string | null {
    const patterns = [
        /<meta\s+[^>]*(?:property|name)=["'](?:og:image|twitter:image)["'][^>]*content=["']([^"']+)["'][^>]*>/i,
        /<meta\s+[^>]*content=["']([^"']+)["'][^>]*(?:property|name)=["'](?:og:image|twitter:image)["'][^>]*>/i,
        /<img\s+[^>]*src=["']([^"']+)["'][^>]*>/i,
        /\[img\]([^\]]+)\[\/img\]/i,
        /(https?:\/\/[^\s\]"'<>]+\.(?:jpe?g|png|gif|webp))(?:[?#][^\s\]"'<>]*)?/i,
    ];

    for (const pattern of patterns) {
        const match = pattern.exec(value);
        const rawUrl = match?.[1]?.trim();
        const normalized = normalizeSteamImageUrl(rawUrl);
        if (normalized) return normalized;
    }

    return null;
}

export function selectNextSteamNewsItem(
    items: SteamNewsItem[],
    lastNewsGid?: string | null,
    lastAnnouncedAt?: number | string | Date | null
): SteamNewsItem | null {
    if (items.length === 0) return null;

    const lastAnnouncedAtMs = parseSteamNewsTimestamp(lastAnnouncedAt);
    const newerItems = lastAnnouncedAtMs === null
        ? items
        : items.filter((item) => item.date * 1000 > lastAnnouncedAtMs);

    if (newerItems.length === 0) return null;
    if (!lastNewsGid) return newerItems[newerItems.length - 1] ?? null;

    const lastIndex = items.findIndex((item) => item.gid === lastNewsGid);
    if (lastIndex < 0) return newerItems[newerItems.length - 1] ?? null;

    const itemsAfterLastGid = items.slice(lastIndex + 1);
    const candidates = lastAnnouncedAtMs === null
        ? itemsAfterLastGid
        : itemsAfterLastGid.filter((item) => item.date * 1000 > lastAnnouncedAtMs);
    return candidates.at(-1) ?? null;
}

export async function registerSteamNewsJobs(queue: JobQueue, now: Date = new Date()): Promise<void> {
    const log = getLogger({ name: 'api:jobs:steamnews' });

    queue.on('steamnews:poll', async (job) => {
        const startedAtDate = new Date();
        const startedAt = startedAtDate.toISOString();
        try {
            const recentRun = await getRecentSteamNewsRun(startedAtDate);
            const recentRunFinishedAt = parseSteamNewsTimestamp(recentRun?.finishedAt);
            const secondsSinceLastRun = recentRunFinishedAt !== null
                ? Math.floor((startedAtDate.getTime() - recentRunFinishedAt) / 1000)
                : null;
            if (secondsSinceLastRun !== null && secondsSinceLastRun < MIN_STEAM_NEWS_POLL_INTERVAL_SECONDS) {
                recordJobRun(STEAM_NEWS_RUN_NAME, {
                    startedAt,
                    finishedAt: new Date().toISOString(),
                    ok: true,
                    meta: {
                        processed: 0,
                        checked: 0,
                        errors: 0,
                        skipped: true,
                        reason: 'recent_successful_run',
                        secondsSinceLastRun,
                    },
                });
                return;
            }

            const result = await processSteamNewsSubscriptions(log);
            const delay = computeNextSteamNewsDelaySeconds();
            const nextAt = new Date(Date.now() + delay * 1000);
            await scheduleSingleton(queue, 'steamnews:poll', {}, delay, `steamnews:next:${formatMinuteKey(nextAt)}`);
            recordJobRun(STEAM_NEWS_RUN_NAME, { startedAt, finishedAt: new Date().toISOString(), ok: result.errors === 0, meta: result });
        } catch (err) {
            recordJobRun(STEAM_NEWS_RUN_NAME, { startedAt, finishedAt: new Date().toISOString(), ok: false, error: err instanceof Error ? err.message : 'Unknown error' });
        } finally {
            await job.done();
        }
    });

    const initialDelay = computeNextSteamNewsDelaySeconds();
    await scheduleSingleton(queue, 'steamnews:poll', {}, 0, `steamnews:catchup:${formatMinuteKey(now)}`);
    await scheduleSingleton(queue, 'steamnews:poll', {}, initialDelay, `steamnews:next:${formatMinuteKey(new Date(now.getTime() + initialDelay * 1000))}`);
    log.info({ initialDelaySeconds: initialDelay }, 'Scheduled Steam news job');
}

function buildSteamNewsEventId(subscription: SteamNewsSubscriptionPlain, item: SteamNewsItem): string {
    return `${subscription.steamAppId}:${item.gid}:${subscription.guildId}:${subscription.discordChannelId}`;
}

async function getRecentSteamNewsRun(startedAt: Date): Promise<JobRun | null> {
    return await JobRun.findOne({
        where: {
            name: STEAM_NEWS_RUN_NAME,
            ok: true,
            finishedAt: {
                [Op.lt]: startedAt,
            },
        },
        order: [
            ['finishedAt', 'DESC'],
            ['id', 'DESC'],
        ],
    });
}

async function updateSteamNewsCursor(
    manager: SteamNewsSubscriptionManager,
    subscription: SteamNewsSubscriptionPlain,
    item: SteamNewsItem
): Promise<void> {
    const { id: rawSubscriptionId, ...subscriptionData } = subscription;
    const subscriptionId = typeof rawSubscriptionId === 'number' ? rawSubscriptionId : Number(rawSubscriptionId);
    const payload: Parameters<SteamNewsSubscriptionManager['upsertSubscription']>[0] = {
        ...subscriptionData,
        ...(Number.isFinite(subscriptionId) ? { id: subscriptionId } : {}),
        paused: Boolean(subscription.paused),
        lastNewsGid: item.gid,
        lastAnnouncedAt: item.date * 1000,
    };
    await manager.upsertSubscription(payload);
}

function parseSteamNewsTimestamp(value: number | string | Date | null | undefined): number | null {
    if (value === null || value === undefined) return null;
    if (value instanceof Date) {
        const time = value.getTime();
        return Number.isFinite(time) ? time : null;
    }

    if (typeof value === 'number') {
        return Number.isFinite(value) ? value : null;
    }

    const numericValue = Number(value);
    if (Number.isFinite(numericValue)) return numericValue;

    const parsed = Date.parse(value);
    return Number.isFinite(parsed) ? parsed : null;
}

async function enrichSteamNewsSubscription(subscription: SteamNewsSubscriptionPlain, log = getLogger({ name: 'api:jobs:steamnews' })): Promise<SteamNewsSubscriptionPlain> {
    const appName = subscription.appName?.trim();
    if (appName) return { ...subscription, appName };

    try {
        const app = await getSteamAppById(subscription.steamAppId);
        const resolvedName = app?.name?.trim();
        if (!resolvedName) return subscription;

        const enriched = { ...subscription, appName: resolvedName };
        await getConfigManager().steamNewsSubscriptionManager.upsertSubscription(enriched as never);
        return enriched;
    } catch (err) {
        log.debug({ err, steamAppId: subscription.steamAppId }, 'Failed to resolve Steam app name for subscription');
        return subscription;
    }
}

function formatSteamNewsDescription(value: string | undefined): string {
    const text = stripSteamMarkup(value ?? '').replace(/\s+/g, ' ').trim();
    if (text.length === 0) return 'New Steam announcement published.';
    if (text.length <= 500) return text;
    return `${text.slice(0, 497)}...`;
}

function stripSteamMarkup(value: string): string {
    return value
        .replace(/<[^>]+>/g, ' ')
        .replace(/\[[^\]]+\]/g, ' ')
        .replace(/&quot;/g, '"')
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>');
}

function normalizeSteamImageUrl(value: string | undefined): string | null {
    if (!value) return null;
    const decoded = decodeHtmlEntities(value);
    if (!isHttpUrl(decoded)) return null;
    return decoded;
}

function isHttpUrl(value: string): boolean {
    try {
        const url = new URL(value);
        return url.protocol === 'https:' || url.protocol === 'http:';
    } catch {
        return false;
    }
}

function decodeHtmlEntities(value: string): string {
    return value
        .replace(/&amp;/g, '&')
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>');
}
