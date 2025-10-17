import { getLogger } from '@zeffuro/fakegaming-common';
import { getConfigManager } from '@zeffuro/fakegaming-common/managers';
import type { JobQueue } from '@zeffuro/fakegaming-common/jobs';
import { scheduleSingleton, formatMinuteKey } from '@zeffuro/fakegaming-common/jobs';
import { toMillis } from '@zeffuro/fakegaming-common/utils';
import { sendChannelMessagePayload } from '../utils/discord.js';
import { recordJobRun } from './status.js';

interface PatchNotePlain {
    game: string;
    title: string;
    content: string;
    url: string;
    publishedAt: number | string | Date;
    logoUrl?: string | null;
    imageUrl?: string | null;
    version?: string | null;
    accentColor?: number | null;
}

interface PatchSubscriptionPlain {
    id: number | string;
    game: string;
    channelId: string;
    guildId: string;
    lastAnnouncedAt?: number | string | Date | null;
}

/**
 * Compute seconds until the next quarter-hour boundary (00, 15, 30, 45).
 * Ensures a minimum of 5 seconds to avoid tight loops.
 */
export function computeNextQuarterHourDelaySeconds(now: Date = new Date(), minSeconds = 5): number {
    const ms = now.getTime();
    const d = new Date(ms);
    const minutes = d.getMinutes();
    const nextQuarter = Math.ceil((minutes + 1) / 15) * 15; // +1 to avoid immediate same-minute scheduling
    const target = new Date(d.getTime());
    target.setSeconds(0, 0);
    if (nextQuarter >= 60) {
        target.setHours(d.getHours() + 1, 0, 0, 0);
    } else {
        target.setMinutes(nextQuarter, 0, 0);
    }
    const diffSec = Math.floor((target.getTime() - ms) / 1000);
    return Math.max(minSeconds, diffSec);
}

/**
 * Build a Discord embed payload for a patch note without requiring discord.js types.
 */
export function buildPatchNoteEmbedPayload(note: PatchNotePlain): Record<string, unknown> {
    const publishedMs = toMillis(note.publishedAt);
    const timestampIso = new Date(publishedMs || Date.now()).toISOString();
    const full = note.content;
    const description = full.length > 350 ? `${full.slice(0, 347)}...` : full;
    const color = typeof note.accentColor === 'number' ? note.accentColor : 0x5865F2;

    const embed: Record<string, unknown> = {
        title: note.title,
        description,
        url: note.url,
        timestamp: timestampIso,
        color,
        author: { name: note.game },
    };
    if (note.logoUrl) embed.thumbnail = { url: String(note.logoUrl) };
    if (note.imageUrl) embed.image = { url: String(note.imageUrl) };

    return { embeds: [embed] };
}

async function processPatchNotesAnnouncements(log = getLogger({ name: 'api:jobs:patchnotes' })): Promise<{ processed: number; errors: number }> {
    const cm = getConfigManager();
    const notes = await cm.patchNotesManager.getAllPlain() as unknown as PatchNotePlain[];
    let processed = 0;
    let errors = 0;

    for (const note of notes) {
        const subs = await cm.patchSubscriptionManager.getSubscriptionsForGame(note.game) as unknown as PatchSubscriptionPlain[];
        const noteTime = toMillis(note.publishedAt);
        for (const sub of subs) {
            const subTime = toMillis(sub.lastAnnouncedAt ?? null);
            if (!subTime || (noteTime && noteTime > subTime)) {
                const payload = buildPatchNoteEmbedPayload(note);
                const sent = await sendChannelMessagePayload(sub.channelId, payload);
                if (sent && typeof (sent as any).id === 'string') {
                    try {
                        await cm.patchSubscriptionManager.upsert({
                            game: sub.game,
                            channelId: sub.channelId,
                            guildId: sub.guildId,
                            id: sub.id,
                            lastAnnouncedAt: noteTime,
                        } as any, ['game', 'channelId']);
                        processed += 1;
                        log.info({ game: note.game, channelId: sub.channelId }, 'Announced patch note');
                    } catch (err) {
                        errors += 1;
                        log.error({ err, game: note.game, channelId: sub.channelId }, 'Failed to update subscription after announcement');
                    }
                } else {
                    errors += 1;
                    log.warn({ game: note.game, channelId: sub.channelId }, 'Failed to send patch note message');
                }
            }
        }
    }

    return { processed, errors };
}

/**
 * Register the Patch Notes job. It runs at quarter-hour boundaries and also once immediately for catch-up.
 */
export async function registerPatchNotesJobs(queue: JobQueue, now: Date = new Date()): Promise<void> {
    const log = getLogger({ name: 'api:jobs:patchnotes' });

    queue.on('patchnotes:run', async (job) => {
        const startedAt = new Date().toISOString();
        try {
            const { processed, errors } = await processPatchNotesAnnouncements(log);
            const delay = computeNextQuarterHourDelaySeconds();
            const nextAt = new Date(Date.now() + delay * 1000);
            const key = `patchnotes:next:${formatMinuteKey(nextAt)}`;
            await scheduleSingleton(queue, 'patchnotes:run', {}, delay, key);
            recordJobRun('patchnotes', { startedAt, finishedAt: new Date().toISOString(), ok: errors === 0, meta: { processed, errors } });
        } catch (err) {
            recordJobRun('patchnotes', { startedAt, finishedAt: new Date().toISOString(), ok: false, error: err instanceof Error ? err.message : 'Unknown error' });
        } finally {
            await job.done();
        }
    });

    const initialDelay = computeNextQuarterHourDelaySeconds(now);
    const initialAt = new Date(now.getTime() + initialDelay * 1000);
    const initKey = `patchnotes:init:${formatMinuteKey(initialAt)}`;
    await scheduleSingleton(queue, 'patchnotes:run', {}, initialDelay, initKey);
    await scheduleSingleton(queue, 'patchnotes:run', {}, 0, `patchnotes:catchup:${formatMinuteKey(now)}`);
    log.info({ initialDelaySeconds: initialDelay }, 'Scheduled patch notes job');
}
