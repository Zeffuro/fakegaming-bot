import { getLogger } from '@zeffuro/fakegaming-common';
import { getConfigManager, followInQuietHours, followLocalTime } from '@zeffuro/fakegaming-common/managers';
import type { UserFollowEvent } from '@zeffuro/fakegaming-common/models';
import { fetchPersonalTwitchStreams } from '@zeffuro/fakegaming-common/notifications';
import { scheduleSingleton, formatMinuteKey, type JobQueue } from '@zeffuro/fakegaming-common/jobs';
import { parseHHmmToMinutes } from '@zeffuro/fakegaming-common/utils';
import { fetchSteamNewsForApp, type SteamNewsItem } from './steamNews.js';
import { sendDirectMessagePayloadResult } from '../utils/discord.js';
import { apiText, resolveUserOutputLocale } from '../localization/locale.js';
import { recordJobRun } from './status.js';
import { personalNotificationPause } from './personalNotificationPause.js';
import { recordNotificationHistory } from './notificationHistory.js';
import type { NotificationHistoryReason, NotificationHistoryStatus } from '@zeffuro/fakegaming-common/api';

const steamCache = new Map<string, { items: SteamNewsItem[]; expiresAt: number }>();
const log = getLogger({ name: 'api:jobs:personal-follows' });
let polling = false;

export async function processPersonalFollows(now = Date.now()): Promise<{ observed: number; sent: number; errors: number }> {
    if (polling) return { observed: 0, sent: 0, errors: 0 };
    polling = true;
    try { return await poll(now); } finally { polling = false; }
}

async function poll(now: number): Promise<{ observed: number; sent: number; errors: number }> {
    const startedAt = Date.now();
    const deliveryTime = () => now + Math.max(0, Date.now() - startedAt);
    const cm = getConfigManager();
    const manager = cm.userFollowManager;
    const journal = async (records: UserFollowEvent[], status: NotificationHistoryStatus, reason: NotificationHistoryReason | null = null, message?: { id?: unknown; channel_id?: unknown }) => {
        for (const event of records) await recordNotificationHistory({ userId: event.userId, kind: 'follow', occurrenceKey: event.id,
            title: event.title, scheduledAt: Number(event.occurredAt), observedAt: deliveryTime(), status, reason,
            messageId: typeof message?.id === 'string' ? message.id : null, channelId: typeof message?.channel_id === 'string' ? message.channel_id : null });
    };
    await journal(await manager.prune(now), 'uncertain', 'interrupted');
    const follows = await manager.active();
    let observed = 0;
    let errors = 0;
    let sent = 0;
    const twitch = follows.filter(follow => follow.provider === 'twitch');
    if (twitch.length) {
        try {
            const streams = await fetchPersonalTwitchStreams(twitch.map(follow => follow.target));
            const byLogin = new Map(streams.map(stream => [stream.user_login, stream]));
            for (const follow of twitch) {
                const stream = byLogin.get(follow.target);
                if (!stream || stream.id === follow.cursor) continue;
                await manager.observe(follow.id, [{ eventKey: stream.id, title: `${stream.user_name}: ${stream.title}`,
                    url: `https://www.twitch.tv/${stream.user_login}`, occurredAt: Date.parse(stream.started_at) }], stream.id);
                observed += 1;
            }
        } catch (error) { errors += 1; log.warn({ err: error }, 'Private Twitch follow polling failed'); }
    }
    const steam = follows.filter(follow => follow.provider === 'steam');
    const targets = new Set(steam.map(follow => follow.target));
    for (const key of steamCache.keys()) if (!targets.has(key)) steamCache.delete(key);
    for (const target of targets) {
        try {
            let cached = steamCache.get(target);
            if (!cached || cached.expiresAt <= now) {
                cached = { items: await fetchSteamNewsForApp(Number(target), 20, AbortSignal.timeout(15_000)), expiresAt: now + 20 * 60_000 };
                steamCache.set(target, cached);
            }
            for (const follow of steam.filter(value => value.target === target)) {
                if (cached.items.at(-1)?.gid === follow.cursor) continue;
                await manager.observe(follow.id, cached.items.filter(item => Number.isSafeInteger(item.date) && item.date > 0)
                    .map(item => ({ eventKey: item.gid, title: `${follow.label}: ${item.title}`, url: item.url, occurredAt: item.date * 1000 })),
                cached.items.at(-1)?.gid ?? follow.cursor);
                observed += 1;
            }
        } catch (error) { errors += 1; log.warn({ err: error, target }, 'Private Steam follow polling failed'); }
    }
    const pending = await manager.pending();
    const users = new Set(pending.map(event => event.userId));
    for (const userId of users) {
        try {
            const records = pending.filter(event => event.userId === userId);
            if (await personalNotificationPause.isPaused(userId)) { await journal(records, 'delayed', 'paused'); continue; }
            const user = await cm.userManager.getUser({ discordId: userId });
            const settings = await manager.preferences(userId, user?.timezone || 'UTC');
            const currentTime = deliveryTime();
            if (followInQuietHours(settings, currentTime)) { await journal(records, 'delayed', 'quietHours'); continue; }
            const local = followLocalTime(settings.timezone, currentTime);
            const locale = await resolveUserOutputLocale(userId);
            for (const mode of ['immediate', 'digest'] as const) {
                if (mode === 'digest' && (local.minutes < (parseHHmmToMinutes(settings.digestAt) ?? 540) || settings.lastDigestDate === local.date)) {
                    await journal(records.filter(event => event.mode === mode), 'delayed', 'digestTime'); continue;
                }
                const batches = followBatches(records.filter(event => event.mode === mode));
                let firstDigest = mode === 'digest';
                for (const batch of batches) {
                    const digestDate = firstDigest ? local.date : undefined;
                    const claimed = await manager.claim(userId, batch.map(event => event.id), digestDate, mode, {
                        now: deliveryTime, expectedDigestDate: mode === 'digest' ? local.date : undefined,
                    });
                    if (claimed.length === 0) { if (firstDigest) break; continue; }
                    await journal(claimed, 'pending');
                    firstDigest = false;
                    const content = `${apiText(locale, mode === 'digest' ? 'personalFollowDigest' : 'personalFollowUpdates')}\n${claimed.map(followLine).join('\n')}`;
                    const gate = await personalNotificationPause.deliver(userId, () => sendDirectMessagePayloadResult(userId, { content, allowed_mentions: { parse: [] } }));
                    if (gate.paused) {
                        await manager.settle(userId, claimed.map(event => event.id), 'pending', mode === 'digest' ? local.date : undefined);
                        await journal(claimed, 'delayed', 'paused'); break;
                    }
                    const result = gate.value;
                    await journal(claimed, result.status === 'sent' ? 'sent' : result.status === 'rejected' ? 'failed' : 'uncertain',
                        result.status === 'sent' ? null : result.status === 'rejected' ? 'retry' : 'unknown', result.status === 'sent' ? result.message : undefined);
                    await manager.settle(userId, claimed.map(event => event.id), result.status === 'sent' ? 'sent' : result.status === 'rejected' ? 'pending' : 'uncertain', mode === 'digest' ? local.date : undefined);
                    if (result.status === 'sent') sent += claimed.length;
                    else { errors += 1; if (result.status === 'rejected') break; }
                }
            }
        } catch (error) { errors += 1; log.warn({ err: error, userId }, 'Private follow delivery failed'); }
    }
    return { observed, sent, errors };
}

function followLine(event: Pick<UserFollowEvent, 'title' | 'url'>): string {
    const title = event.title.replace(/[\r\n<>]/g, ' ').slice(0, 150);
    return `${title}\n<${event.url}>`;
}

export function followBatches(events: UserFollowEvent[]): UserFollowEvent[][] {
    const batches: UserFollowEvent[][] = [];
    let batch: UserFollowEvent[] = [];
    let length = 0;
    for (const event of events) {
        const nextLength = followLine(event).length + 1;
        if (batch.length && length + nextLength > 1800) { batches.push(batch); batch = []; length = 0; }
        batch.push(event);
        length += nextLength;
    }
    if (batch.length) batches.push(batch);
    return batches;
}

export async function registerPersonalFollowJobs(queue: JobQueue): Promise<void> {
    queue.on('personal-follows:run', async job => {
        const startedAt = new Date().toISOString();
        try {
            const result = await processPersonalFollows();
            recordJobRun('personal-follows', { startedAt, finishedAt: new Date().toISOString(), ok: result.errors === 0, meta: result });
        } catch (error) {
            log.warn({ err: error }, 'Private follows job failed');
            recordJobRun('personal-follows', { startedAt, finishedAt: new Date().toISOString(), ok: false, error: error instanceof Error ? error.message : 'Unknown error' });
        } finally {
            try {
                await scheduleSingleton(queue, 'personal-follows:run', {}, 120, `personal-follows:${formatMinuteKey(new Date(Date.now() + 120_000))}`);
            } finally { await job.done(); }
        }
    });
    await scheduleSingleton(queue, 'personal-follows:run', {}, 5, `personal-follows:init:${formatMinuteKey(new Date())}`);
}
