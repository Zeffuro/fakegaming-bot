import { getLogger } from '@zeffuro/fakegaming-common';
import { MorningBriefingManager } from '@zeffuro/fakegaming-common/managers';
import { formatMinuteKey, scheduleSingleton, type JobQueue } from '@zeffuro/fakegaming-common/jobs';
import { resolveUserOutputLocale } from '../localization/locale.js';
import { sendDirectMessagePayloadResult } from '../utils/discord.js';
import { formatMorningBriefing, loadMorningAgenda } from '../personalToday/morningBriefing.js';
import { recordJobRun } from './status.js';
import { recordNotificationHistory } from './notificationHistory.js';
import { personalNotificationPause } from './personalNotificationPause.js';
import { MorningBriefingDelivery } from '@zeffuro/fakegaming-common/models';
import type { NotificationHistoryReason, NotificationHistoryStatus } from '@zeffuro/fakegaming-common/api';

const manager = new MorningBriefingManager();
const log = getLogger({ name: 'api:jobs:morning-briefings' });
let running = false;

export async function processMorningBriefings(now = Date.now()): Promise<{ sent: number; skipped: number; errors: number }> {
    if (running) return { sent: 0, skipped: 0, errors: 0 };
    running = true; const started = Date.now(); const current = () => now + Math.max(0, Date.now() - started);
    let sent = 0; let skipped = 0; let errors = 0;
    try {
        for (const claim of await manager.recover(current())) await recordNotificationHistory({ userId: claim.userId,
            kind: 'briefing', occurrenceKey: claim.localDate, title: '', scheduledAt: Number(claim.attemptedAt),
            observedAt: current(), status: 'uncertain', reason: 'interrupted' });
        for (const userId of await manager.active()) {
            try {
                let candidate = await manager.historyCandidate(userId, current()).catch(error => {
                    log.warn({ err: error }, 'Briefing history schedule unavailable'); return null;
                });
                const history = (status: NotificationHistoryStatus, reason: NotificationHistoryReason | null = null, message?: { id?: unknown; channel_id?: unknown }) =>
                    recordNotificationHistory({ userId, kind: 'briefing', occurrenceKey: candidate!.localDate, title: '', scheduledAt: candidate!.scheduledAt,
                        observedAt: current(), status, reason, messageId: typeof message?.id === 'string' ? message.id : null,
                        channelId: typeof message?.channel_id === 'string' ? message.channel_id : null });
                if (candidate && await personalNotificationPause.isPaused(userId).catch(() => false)) { await history('delayed', 'paused'); continue; }
                const claim = await manager.claim(userId, current);
                if (!claim) continue;
                if (candidate?.localDate !== claim.localDate || candidate.version !== claim.settingsVersion || candidate.timezone !== claim.timezone) {
                    candidate = { localDate: claim.localDate, scheduledAt: Number(claim.attemptedAt), version: claim.settingsVersion, timezone: claim.timezone };
                }
                await history('pending');
                let preview;
                try {
                    const [agenda, locale] = await Promise.all([loadMorningAgenda(userId, claim.timezone, current()), resolveUserOutputLocale(userId)]);
                    preview = formatMorningBriefing(agenda, locale);
                } catch (error) {
                    await manager.deliver(claim, current, async () => 'rejected'); await history('failed', 'retry'); throw error;
                }
                let message: { id?: unknown; channel_id?: unknown } | undefined;
                let observedSend: 'sent' | 'rejected' | 'uncertain' | undefined;
                const result = await manager.deliver(claim, current, async stillEligible => {
                    if (preview.empty || preview.day !== claim.localDate || !stillEligible()) return 'skipped';
                    const result = await sendDirectMessagePayloadResult(userId, { content: preview.content, allowed_mentions: { parse: [] } });
                    if (result.status === 'sent') message = result.message;
                    observedSend = result.status === 'unknown' ? 'uncertain' : result.status;
                    return observedSend;
                }).catch(async error => {
                    if (observedSend) await history(observedSend === 'sent' ? 'sent' : observedSend === 'uncertain' ? 'uncertain' : 'failed',
                        observedSend === 'sent' ? null : observedSend === 'uncertain' ? 'unknown' : 'retry', message);
                    throw error;
                });
                const final = result === 'skipped' ? await MorningBriefingDelivery.findOne({ where: { id: claim.id, userId } }).catch(() => null) : null;
                const paused = result === 'skipped' && final?.status === 'rejected';
                if (result !== 'skipped' || final) await history(paused ? 'delayed' : result === 'sent' ? 'sent' : result === 'rejected' ? 'failed' : result === 'uncertain' ? 'uncertain' : 'skipped',
                    paused ? 'paused' : result === 'rejected' ? 'retry' : result === 'uncertain' ? 'unknown' : result === 'skipped' ? preview.empty ? 'empty' : 'ineligible' : null, message);
                if (result === 'sent') sent++; else if (result === 'skipped') skipped++; else errors++;
            } catch (error) { errors++; log.warn({ err: error, userId }, 'Private morning briefing failed'); }
        }
        return { sent, skipped, errors };
    } finally { running = false; }
}

export async function registerMorningBriefingJobs(queue: JobQueue): Promise<void> {
    queue.on('morning-briefings:run', async job => {
        const startedAt = new Date().toISOString();
        try {
            const result = await processMorningBriefings();
            recordJobRun('morning-briefings', { startedAt, finishedAt: new Date().toISOString(), ok: result.errors === 0, meta: result });
        } catch (error) {
            log.warn({ err: error }, 'Morning briefing job failed');
            recordJobRun('morning-briefings', { startedAt, finishedAt: new Date().toISOString(), ok: false, error: 'Morning briefing processing failed' });
        } finally {
            try { await scheduleSingleton(queue, 'morning-briefings:run', {}, 60, `morning-briefings:${formatMinuteKey(new Date(Date.now() + 60_000))}`); }
            finally { await job.done(); }
        }
    });
    await scheduleSingleton(queue, 'morning-briefings:run', {}, 5, `morning-briefings:init:${formatMinuteKey(new Date())}`);
}
