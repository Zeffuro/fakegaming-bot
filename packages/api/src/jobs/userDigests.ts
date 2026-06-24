import { getLogger } from '@zeffuro/fakegaming-common';
import { getConfigManager } from '@zeffuro/fakegaming-common/managers';
import type { UserDigestSubscriptionRecord } from '@zeffuro/fakegaming-common/managers';
import type { JobQueue } from '@zeffuro/fakegaming-common/jobs';
import { computeNextMinuteBoundaryDelaySeconds, formatMinuteKey, scheduleSingleton } from '@zeffuro/fakegaming-common/jobs';
import {
    computeNextDigestRunAt,
    getDigestWindowMs,
    parseDigestCategories,
    type DigestFrequency,
} from '@zeffuro/fakegaming-common/utils';
import { sendDirectMessage } from '../utils/discord.js';
import { recordJobRun } from './status.js';

interface ReminderPlain {
    id: string;
    userId: string;
    message: string;
    timestamp: number | string;
    completed?: boolean | number | string | null;
}

interface DigestReminderItem {
    id: string;
    message: string;
    timestamp: number;
}

interface AnimeSubscriptionPlain {
    id?: number | string | null;
    anilistId: number | string;
    targetType?: string | null;
    userId?: string | null;
    reminderMinutes?: number | string | null;
    paused?: boolean | number | string | null;
}

interface AnimeTitlePlain {
    anilistId: number | string;
    titleRomaji?: string | null;
    titleEnglish?: string | null;
    titleNative?: string | null;
    nextEpisode?: number | string | null;
    nextAiringAt?: number | string | null;
}

interface DigestAnimeItem {
    id: string;
    anilistId: number;
    title: string;
    episode: number | null;
    airingAt: number;
    reminderAt: number;
}

const retryDelaySeconds = 15 * 60;
const timestampSecondThreshold = 1_000_000_000_000;

export function computeNextDigestRunDelaySeconds(now: Date = new Date()): number {
    return computeNextMinuteBoundaryDelaySeconds(now, 10);
}

export function buildReminderDigestContent(input: {
    frequency: DigestFrequency;
    timezone: string;
    runAt: string;
    reminders: DigestReminderItem[];
    windowEndsAt: number;
}): string {
    const title = input.frequency === 'weekly' ? 'Weekly reminder digest' : 'Daily reminder digest';
    const header = `${title} (${input.timezone}, ${input.runAt})`;
    const windowLine = `Upcoming reminders through <t:${Math.floor(input.windowEndsAt / 1000)}:f>.`;
    const lines = input.reminders.slice(0, 10).map((reminder) =>
        `- <t:${Math.floor(reminder.timestamp / 1000)}:f> (<t:${Math.floor(reminder.timestamp / 1000)}:R>) - ${reminder.message}`
    );
    const suffix = input.reminders.length > 10 ? `\n...and ${input.reminders.length - 10} more.` : '';
    return `${header}\n${windowLine}\n\n${lines.join('\n')}${suffix}`;
}

export function buildUserDigestContent(input: {
    frequency: DigestFrequency;
    timezone: string;
    runAt: string;
    reminders: DigestReminderItem[];
    animeItems: DigestAnimeItem[];
    windowEndsAt: number;
}): string {
    const title = input.frequency === 'weekly' ? 'Weekly personal digest' : 'Daily personal digest';
    const header = `${title} (${input.timezone}, ${input.runAt})`;
    const windowLine = `Upcoming items through <t:${Math.floor(input.windowEndsAt / 1000)}:f>.`;
    const sections = [
        buildReminderDigestSection(input.reminders),
        buildAnimeDigestSection(input.animeItems),
    ].filter((section): section is string => section !== null);

    return `${header}\n${windowLine}\n\n${sections.join('\n\n')}`;
}

function buildReminderDigestSection(reminders: DigestReminderItem[]): string | null {
    if (reminders.length === 0) return null;
    const lines = reminders.slice(0, 10).map((reminder) =>
        `- <t:${Math.floor(reminder.timestamp / 1000)}:f> (<t:${Math.floor(reminder.timestamp / 1000)}:R>) - ${reminder.message}`
    );
    const suffix = reminders.length > 10 ? `\n...and ${reminders.length - 10} more.` : '';
    return `Reminders\n${lines.join('\n')}${suffix}`;
}

function buildAnimeDigestSection(animeItems: DigestAnimeItem[]): string | null {
    if (animeItems.length === 0) return null;
    const lines = animeItems.slice(0, 10).map((item) => {
        const episodeLabel = item.episode === null ? '' : ` episode ${item.episode}`;
        return `- <t:${Math.floor(item.reminderAt / 1000)}:f> (<t:${Math.floor(item.reminderAt / 1000)}:R>) - ${item.title}${episodeLabel} airs <t:${Math.floor(item.airingAt / 1000)}:R>.`;
    });
    const suffix = animeItems.length > 10 ? `\n...and ${animeItems.length - 10} more.` : '';
    return `Anime reminders\n${lines.join('\n')}${suffix}`;
}

async function processUserDigests(now: Date, log = getLogger({ name: 'api:jobs:user-digests' })): Promise<{ processed: number; sent: number; skipped: number; errors: number }> {
    const cm = getConfigManager();
    const nowMs = now.getTime();
    const subscriptions = await cm.userDigestSubscriptionManager.listDue(nowMs);
    let processed = 0;
    let sent = 0;
    let skipped = 0;
    let errors = 0;

    for (const subscription of subscriptions) {
        processed += 1;
        const frequency = normalizeFrequency(subscription.frequency);
        const categories = parseDigestCategories((subscription as { categories?: unknown }).categories);
        const nextRunAt = getNextRunAfter(subscription, nowMs);

        if (!frequency || categories.length === 0 || nextRunAt === null) {
            await cm.userDigestSubscriptionManager.scheduleRetry(subscription.id, nowMs + retryDelaySeconds * 1000);
            errors += 1;
            log.warn({ subscriptionId: subscription.id, discordId: subscription.discordId }, 'Invalid user digest subscription');
            continue;
        }

        try {
            const windowEndsAt = nowMs + getDigestWindowMs(frequency);
            const reminders = categories.includes('reminders')
                ? await listDigestReminderItems(subscription.discordId, nowMs, windowEndsAt)
                : [];
            const animeItems = categories.includes('anime')
                ? await listDigestAnimeItems(subscription.discordId, nowMs, windowEndsAt)
                : [];

            if (reminders.length === 0 && animeItems.length === 0) {
                await cm.userDigestSubscriptionManager.markRun(subscription.id, {
                    lastRunAt: nowMs,
                    nextRunAt,
                });
                skipped += 1;
                continue;
            }

            const content = categories.includes('anime')
                ? buildUserDigestContent({
                    frequency,
                    timezone: subscription.timezone,
                    runAt: subscription.runAt,
                    reminders,
                    animeItems,
                    windowEndsAt,
                })
                : buildReminderDigestContent({
                    frequency,
                    timezone: subscription.timezone,
                    runAt: subscription.runAt,
                    reminders,
                    windowEndsAt,
                });
            const delivered = await sendDirectMessage(subscription.discordId, content);
            if (!delivered) {
                await cm.userDigestSubscriptionManager.scheduleRetry(subscription.id, nowMs + retryDelaySeconds * 1000);
                errors += 1;
                continue;
            }

            await cm.userDigestSubscriptionManager.markRun(subscription.id, {
                lastRunAt: nowMs,
                lastSentAt: nowMs,
                nextRunAt,
            });
            sent += 1;
        } catch (err) {
            await cm.userDigestSubscriptionManager.scheduleRetry(subscription.id, nowMs + retryDelaySeconds * 1000).catch(() => undefined);
            errors += 1;
            log.error({ err, subscriptionId: subscription.id, discordId: subscription.discordId }, 'Failed to process user digest subscription');
        }
    }

    return { processed, sent, skipped, errors };
}

function normalizeFrequency(value: string): DigestFrequency | null {
    return value === 'daily' || value === 'weekly' ? value : null;
}

function getNextRunAfter(subscription: UserDigestSubscriptionRecord, nowMs: number): number | null {
    const frequency = normalizeFrequency(subscription.frequency);
    if (!frequency) return null;

    return computeNextDigestRunAt({
        frequency,
        timezone: subscription.timezone,
        runAt: subscription.runAt,
        dayOfWeek: normalizeNullableNumber(subscription.dayOfWeek),
        afterTimestamp: nowMs,
    });
}

async function listDigestReminderItems(userId: string, nowMs: number, windowEndsAt: number): Promise<DigestReminderItem[]> {
    const rows = await getConfigManager().reminderManager.getRemindersByUser(userId) as unknown as ReminderPlain[];
    return rows
        .map(normalizeReminder)
        .filter((reminder): reminder is DigestReminderItem => (
            reminder !== null
            && reminder.timestamp >= nowMs
            && reminder.timestamp <= windowEndsAt
        ))
        .sort((left, right) => left.timestamp - right.timestamp);
}

async function listDigestAnimeItems(userId: string, nowMs: number, windowEndsAt: number): Promise<DigestAnimeItem[]> {
    const cm = getConfigManager();
    const rows = await cm.animeManager.subscriptions.getUserSubscriptions(userId) as unknown as AnimeSubscriptionPlain[];
    const items: DigestAnimeItem[] = [];

    for (const subscription of rows) {
        if (subscription.targetType && subscription.targetType !== 'dm') continue;
        if (isPaused(subscription.paused)) continue;

        const anilistId = normalizeInteger(subscription.anilistId);
        if (anilistId === null) continue;

        const title = await cm.animeManager.titles.getOnePlain({ anilistId }) as unknown as AnimeTitlePlain | null;
        const airingAt = normalizeTimestamp(title?.nextAiringAt);
        if (airingAt === null || airingAt <= nowMs) continue;

        const reminderMinutes = normalizeNonNegativeNumber(subscription.reminderMinutes, 30);
        const reminderAt = airingAt - reminderMinutes * 60 * 1000;
        if (reminderAt < nowMs || reminderAt > windowEndsAt) continue;

        items.push({
            id: String(subscription.id ?? `${userId}:${anilistId}`),
            anilistId,
            title: formatAnimeTitle(title, anilistId),
            episode: normalizeInteger(title?.nextEpisode),
            airingAt,
            reminderAt,
        });
    }

    return items.sort((left, right) => (
        left.reminderAt - right.reminderAt
        || left.airingAt - right.airingAt
        || left.title.localeCompare(right.title)
        || left.anilistId - right.anilistId
    ));
}

function normalizeReminder(reminder: ReminderPlain): DigestReminderItem | null {
    if (isPaused(reminder.completed)) return null;
    const timestamp = typeof reminder.timestamp === 'number' ? reminder.timestamp : Number(reminder.timestamp);
    if (!Number.isFinite(timestamp)) return null;
    return {
        id: reminder.id,
        message: reminder.message,
        timestamp,
    };
}

function formatAnimeTitle(title: AnimeTitlePlain | null, anilistId: number): string {
    return title?.titleEnglish?.trim()
        || title?.titleRomaji?.trim()
        || title?.titleNative?.trim()
        || `AniList #${anilistId}`;
}

function normalizeInteger(value: unknown): number | null {
    if (value === null || value === undefined) return null;
    const parsed = typeof value === 'number' ? value : Number(value);
    return Number.isInteger(parsed) ? parsed : null;
}

function normalizeNonNegativeNumber(value: unknown, fallback: number): number {
    const parsed = typeof value === 'number' ? value : Number(value);
    return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
}

function normalizeTimestamp(value: unknown): number | null {
    const parsed = typeof value === 'number' ? value : Number(value);
    if (!Number.isFinite(parsed) || parsed <= 0) return null;
    return parsed < timestampSecondThreshold ? parsed * 1000 : parsed;
}

function isPaused(value: unknown): boolean {
    return value === true || value === 1 || value === '1';
}

function normalizeNullableNumber(value: unknown): number | null {
    if (value === null || value === undefined) return null;
    const parsed = typeof value === 'number' ? value : Number(value);
    return Number.isFinite(parsed) ? parsed : null;
}

export async function registerUserDigestJobs(queue: JobQueue, now: Date = new Date()): Promise<void> {
    const log = getLogger({ name: 'api:jobs:user-digests' });

    queue.on('user-digests:run', async (job) => {
        const startedAt = new Date().toISOString();
        try {
            const result = await processUserDigests(new Date());
            const delay = computeNextDigestRunDelaySeconds();
            const nextAt = new Date(Date.now() + delay * 1000);
            await scheduleSingleton(queue, 'user-digests:run', {}, delay, `user-digests:next:${formatMinuteKey(nextAt)}`);
            recordJobRun('user-digests', { startedAt, finishedAt: new Date().toISOString(), ok: result.errors === 0, meta: result });
        } catch (err) {
            recordJobRun('user-digests', { startedAt, finishedAt: new Date().toISOString(), ok: false, error: err instanceof Error ? err.message : 'Unknown error' });
        } finally {
            await job.done();
        }
    });

    const initialDelay = computeNextDigestRunDelaySeconds(now);
    const initialAt = new Date(now.getTime() + initialDelay * 1000);
    await scheduleSingleton(queue, 'user-digests:run', {}, initialDelay, `user-digests:init:${formatMinuteKey(initialAt)}`);
    log.info({ initialDelaySeconds: initialDelay }, 'Scheduled user digest job');
}
