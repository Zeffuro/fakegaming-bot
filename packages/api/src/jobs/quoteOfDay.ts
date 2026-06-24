import { getLogger } from '@zeffuro/fakegaming-common';
import { getConfigManager } from '@zeffuro/fakegaming-common/managers';
import type { QuoteOfDayConfigRecord } from '@zeffuro/fakegaming-common/managers';
import type { JobQueue } from '@zeffuro/fakegaming-common/jobs';
import { scheduleSingleton } from '@zeffuro/fakegaming-common/jobs';
import {
    buildQuoteOfDayEventId,
    formatQuoteOfDayDateKey,
    quoteOfDayProvider,
    selectQuoteOfDay,
    type QuoteOfDayCandidate,
} from '@zeffuro/fakegaming-common/utils';
import { sendChannelMessage } from '../utils/discord.js';
import { recordJobRun } from './status.js';

interface QuoteOfDayJobResult {
    processed: number;
    sent: number;
    skipped: number;
    failures: number;
}

interface QuoteOfDayFailure {
    eventId: string;
    guildId: string;
    channelId: string;
}

const retryDelaySeconds = 15 * 60;
const maxRetryAttempts = 3;

export function computeNextQuoteOfDayRunDelaySeconds(now: Date = new Date()): number {
    const next = new Date(now.getTime());
    next.setUTCMinutes(0, 0, 0);
    next.setUTCHours(next.getUTCHours() + 1);
    return Math.max(1, Math.floor((next.getTime() - now.getTime()) / 1000));
}

export function buildQuoteOfDayContent(input: { dateKey: string; quote: QuoteOfDayCandidate }): string {
    return [
        `Quote of the day (${input.dateKey})`,
        `"${input.quote.quote}"`,
        `- <@${input.quote.authorId}>`,
    ].join('\n');
}

async function processQuoteOfDayForDate(date: Date, force: boolean, log = getLogger({ name: 'api:jobs:quoteofday' })): Promise<QuoteOfDayJobResult & { retryFailures: QuoteOfDayFailure[] }> {
    const cm = getConfigManager();
    const runHourUtc = date.getUTCHours();
    const configs = await cm.quoteOfDayManager.listEnabledForHour(runHourUtc) as QuoteOfDayConfigRecord[];
    const retryFailures: QuoteOfDayFailure[] = [];
    let processed = 0;
    let sent = 0;
    let skipped = 0;
    let failures = 0;

    for (const config of configs) {
        processed += 1;
        const quotes = await cm.quoteManager.getQuotesByGuild(config.guildId) as unknown as QuoteOfDayCandidate[];
        const selection = selectQuoteOfDay(quotes, config.guildId, date);
        if (!selection.quote) {
            skipped += 1;
            continue;
        }

        const eventId = buildQuoteOfDayEventId(config.guildId, date);
        try {
            if (!force) {
                const { created } = await cm.notificationsManager.recordIfNew({
                    provider: quoteOfDayProvider,
                    eventId,
                    guildId: config.guildId,
                    channelId: config.channelId,
                });
                if (!created) {
                    skipped += 1;
                    continue;
                }
            }

            const response = await sendChannelMessage(config.channelId, buildQuoteOfDayContent({
                dateKey: selection.dateKey,
                quote: selection.quote,
            }));
            if (response && typeof (response as { id?: unknown }).id === 'string') {
                await cm.notificationsManager.setMessageMeta(quoteOfDayProvider, eventId, {
                    guildId: config.guildId,
                    channelId: config.channelId,
                    messageId: (response as { id: string }).id,
                });
                sent += 1;
                continue;
            }

            failures += 1;
            retryFailures.push({ eventId, guildId: config.guildId, channelId: config.channelId });
            log.warn({ eventId, channelId: config.channelId }, 'Quote-of-the-day send returned no message id');
        } catch (err) {
            failures += 1;
            retryFailures.push({ eventId, guildId: config.guildId, channelId: config.channelId });
            log.error({ err, eventId }, 'Failed to process quote-of-the-day config');
        }
    }

    return { processed, sent, skipped, failures, retryFailures };
}

export async function runQuoteOfDayOnce(date: Date, opts: { force?: boolean } = {}): Promise<QuoteOfDayJobResult> {
    const startedAt = new Date().toISOString();
    const result = await processQuoteOfDayForDate(date, opts.force === true);
    recordJobRun('quoteofday', {
        startedAt,
        finishedAt: new Date().toISOString(),
        ok: result.failures === 0,
        meta: {
            processed: result.processed,
            sent: result.sent,
            skipped: result.skipped,
            failures: result.failures,
            date: date.toISOString(),
            force: opts.force === true,
        },
    });
    return {
        processed: result.processed,
        sent: result.sent,
        skipped: result.skipped,
        failures: result.failures,
    };
}

export async function registerQuoteOfDayJobs(queue: JobQueue, now: Date = new Date()): Promise<void> {
    const log = getLogger({ name: 'api:jobs:quoteofday' });

    queue.on<{ date?: string; force?: boolean }>('quoteofday:run', async (job) => {
        const startedAt = new Date().toISOString();
        const date = job.data?.date ? new Date(job.data.date) : new Date();
        const force = job.data?.force === true;
        try {
            const result = await processQuoteOfDayForDate(date, force, log);
            for (const failure of result.retryFailures) {
                await scheduleQuoteOfDayRetry(queue, failure, 1);
            }

            const delay = computeNextQuoteOfDayRunDelaySeconds();
            const nextAt = new Date(Date.now() + delay * 1000);
            await scheduleSingleton(queue, 'quoteofday:run', {}, delay, buildRunKey('next', nextAt));
            recordJobRun('quoteofday', {
                startedAt,
                finishedAt: new Date().toISOString(),
                ok: result.failures === 0,
                meta: {
                    processed: result.processed,
                    sent: result.sent,
                    skipped: result.skipped,
                    failures: result.failures,
                    date: date.toISOString(),
                    force,
                },
            });
        } catch (err) {
            recordJobRun('quoteofday', {
                startedAt,
                finishedAt: new Date().toISOString(),
                ok: false,
                error: err instanceof Error ? err.message : 'Unknown error',
                meta: { date: date.toISOString(), force },
            });
        } finally {
            await job.done();
        }
    });

    queue.on<{ eventId: string; attempt?: number }>('quoteofday:retry', async (job) => {
        const startedAt = new Date().toISOString();
        const eventId = job.data?.eventId;
        const attempt = Math.max(1, Number(job.data?.attempt ?? 1));
        try {
            const result = typeof eventId === 'string'
                ? await retryQuoteOfDayEvent(eventId, attempt, queue)
                : false;
            recordJobRun('quoteofday:retry', {
                startedAt,
                finishedAt: new Date().toISOString(),
                ok: result,
                error: result ? undefined : 'Send failed',
                meta: { eventId, attempt },
            });
        } catch (err) {
            recordJobRun('quoteofday:retry', {
                startedAt,
                finishedAt: new Date().toISOString(),
                ok: false,
                error: err instanceof Error ? err.message : 'Unknown error',
                meta: { eventId, attempt },
            });
        } finally {
            await job.done();
        }
    });

    const initialDelay = computeNextQuoteOfDayRunDelaySeconds(now);
    const initialAt = new Date(now.getTime() + initialDelay * 1000);
    await scheduleSingleton(queue, 'quoteofday:run', {}, initialDelay, buildRunKey('init', initialAt));
    await scheduleSingleton(queue, 'quoteofday:run', { date: now.toISOString() }, 0, buildRunKey('catchup', now));
    log.info({ initialDelaySeconds: initialDelay }, 'Scheduled quote-of-the-day job');
}

async function retryQuoteOfDayEvent(eventId: string, attempt: number, queue: JobQueue): Promise<boolean> {
    const parsed = parseQuoteOfDayEventId(eventId);
    if (!parsed) return false;

    const cm = getConfigManager();
    const notification = await cm.notificationsManager.getOnePlain({
        provider: quoteOfDayProvider,
        eventId,
    } as never);
    const channelId = typeof notification?.channelId === 'string' ? notification.channelId : null;
    if (!channelId) return false;

    const quotes = await cm.quoteManager.getQuotesByGuild(parsed.guildId) as unknown as QuoteOfDayCandidate[];
    const selection = selectQuoteOfDay(quotes, parsed.guildId, new Date(`${parsed.dateKey}T00:00:00.000Z`));
    if (!selection.quote) return false;

    const response = await sendChannelMessage(channelId, buildQuoteOfDayContent({
        dateKey: selection.dateKey,
        quote: selection.quote,
    }));
    if (response && typeof (response as { id?: unknown }).id === 'string') {
        await cm.notificationsManager.setMessageMeta(quoteOfDayProvider, eventId, {
            guildId: parsed.guildId,
            channelId,
            messageId: (response as { id: string }).id,
        });
        return true;
    }

    if (attempt < maxRetryAttempts) {
        await scheduleQuoteOfDayRetry(queue, { eventId, guildId: parsed.guildId, channelId }, attempt + 1);
    }
    return false;
}

async function scheduleQuoteOfDayRetry(queue: JobQueue, failure: QuoteOfDayFailure, attempt: number): Promise<void> {
    await scheduleSingleton(
        queue,
        'quoteofday:retry',
        { eventId: failure.eventId, attempt },
        retryDelaySeconds,
        `quoteofday:retry:${failure.eventId}:${attempt}`,
    );
}

function buildRunKey(kind: string, date: Date): string {
    return `quoteofday:${kind}:${formatQuoteOfDayDateKey(date)}:${date.getUTCHours()}`;
}

function parseQuoteOfDayEventId(eventId: string): { guildId: string; dateKey: string } | null {
    const parts = eventId.split(':');
    if (parts.length !== 2 || !parts[0] || !parts[1]) return null;
    return { guildId: parts[0], dateKey: parts[1] };
}
