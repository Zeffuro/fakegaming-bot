import { getLogger } from '@zeffuro/fakegaming-common';
import { getConfigManager } from '@zeffuro/fakegaming-common/managers';
import type { JobQueue } from '@zeffuro/fakegaming-common/jobs';
import { formatMinuteKey, scheduleSingleton } from '@zeffuro/fakegaming-common/jobs';
import { getNotificationSuppression } from './notificationSuppression.js';
import { sendJobNotification, type JobNotificationManager } from './jobNotifications.js';
import { recordIntegrationFailure, recordIntegrationSuccess } from './integrationHealth.js';
import { recordJobRun } from './status.js';

const STEAM_NEWS_PROVIDER = 'steamnews';
const STEAM_NEWS_FEED = 'steam_community_announcements';

export interface SteamNewsItem {
    gid: string;
    title: string;
    url: string;
    contents?: string;
    date: number;
    feedlabel?: string;
    feedname?: string;
    author?: string;
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

export function buildSteamNewsEmbedPayload(subscription: SteamNewsSubscriptionPlain, item: SteamNewsItem): Record<string, unknown> {
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
            const items = await fetchSteamNewsForApp(subscription.steamAppId);
            const nextItem = selectNextSteamNewsItem(items, subscription.lastNewsGid);
            if (!nextItem) {
                await recordIntegrationSuccess(STEAM_NEWS_PROVIDER, {
                    id: subscription.id,
                    guildId: subscription.guildId,
                    channelId: subscription.discordChannelId,
                }, {
                    metadata: {
                        steamAppId: subscription.steamAppId,
                        appName: subscription.appName ?? null,
                    },
                });
                continue;
            }

            const suppression = getNotificationSuppression({
                ...subscription,
                lastNotifiedAt: subscription.lastAnnouncedAt ?? null,
            }, new Date());

            if (suppression.shouldSuppress) {
                await recordIntegrationSuccess(STEAM_NEWS_PROVIDER, {
                    id: subscription.id,
                    guildId: subscription.guildId,
                    channelId: subscription.discordChannelId,
                }, {
                    metadata: {
                        steamAppId: subscription.steamAppId,
                        suppressedByQuiet: suppression.suppressedByQuiet,
                        suppressedByCooldown: suppression.suppressedByCooldown,
                    },
                });
                continue;
            }

            const eventId = buildSteamNewsEventId(subscription, nextItem);
            const sent = await sendJobNotification({
                manager: notifications,
                provider: STEAM_NEWS_PROVIDER,
                eventId,
                channelId: subscription.discordChannelId,
                guildId: subscription.guildId,
                payload: buildSteamNewsEmbedPayload(subscription, nextItem),
            });

            if (!sent) {
                throw new Error('Discord send returned no message id');
            }

            const { id: rawSubscriptionId, ...subscriptionData } = subscription;
            const subscriptionId = typeof rawSubscriptionId === 'number' ? rawSubscriptionId : Number(rawSubscriptionId);
            await cm.steamNewsSubscriptionManager.upsertSubscription({
                ...subscriptionData,
                ...(Number.isFinite(subscriptionId) ? { id: subscriptionId } : {}),
                paused: Boolean(subscription.paused),
                lastNewsGid: nextItem.gid,
                lastAnnouncedAt: nextItem.date * 1000,
            });
            processed += 1;
            await recordIntegrationSuccess(STEAM_NEWS_PROVIDER, {
                id: subscription.id,
                guildId: subscription.guildId,
                channelId: subscription.discordChannelId,
            }, {
                delivered: true,
                metadata: {
                    steamAppId: subscription.steamAppId,
                    appName: subscription.appName ?? null,
                    newsGid: nextItem.gid,
                    newsUrl: nextItem.url,
                },
            });
        } catch (err) {
            errors += 1;
            await recordIntegrationFailure(STEAM_NEWS_PROVIDER, {
                id: subscription.id,
                guildId: subscription.guildId,
                channelId: subscription.discordChannelId,
            }, err, {
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

export function selectNextSteamNewsItem(items: SteamNewsItem[], lastNewsGid?: string | null): SteamNewsItem | null {
    if (items.length === 0) return null;
    if (!lastNewsGid) return items[items.length - 1] ?? null;

    const lastIndex = items.findIndex((item) => item.gid === lastNewsGid);
    if (lastIndex < 0) return items[items.length - 1] ?? null;
    return items.slice(lastIndex + 1).at(-1) ?? null;
}

export async function registerSteamNewsJobs(queue: JobQueue, now: Date = new Date()): Promise<void> {
    const log = getLogger({ name: 'api:jobs:steamnews' });

    queue.on('steamnews:poll', async (job) => {
        const startedAt = new Date().toISOString();
        try {
            const result = await processSteamNewsSubscriptions(log);
            const delay = computeNextSteamNewsDelaySeconds();
            const nextAt = new Date(Date.now() + delay * 1000);
            await scheduleSingleton(queue, 'steamnews:poll', {}, delay, `steamnews:next:${formatMinuteKey(nextAt)}`);
            recordJobRun('steamnews', { startedAt, finishedAt: new Date().toISOString(), ok: result.errors === 0, meta: result });
        } catch (err) {
            recordJobRun('steamnews', { startedAt, finishedAt: new Date().toISOString(), ok: false, error: err instanceof Error ? err.message : 'Unknown error' });
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
