import { getLogger } from '@zeffuro/fakegaming-common';
import { MorningBriefingManager } from '@zeffuro/fakegaming-common/managers';
import { formatMinuteKey, scheduleSingleton, type JobQueue } from '@zeffuro/fakegaming-common/jobs';
import { resolveUserOutputLocale } from '../localization/locale.js';
import { sendDirectMessagePayloadResult } from '../utils/discord.js';
import { formatMorningBriefing, loadMorningAgenda } from '../personalToday/morningBriefing.js';
import { recordJobRun } from './status.js';

const manager = new MorningBriefingManager();
const log = getLogger({ name: 'api:jobs:morning-briefings' });
let running = false;

export async function processMorningBriefings(now = Date.now()): Promise<{ sent: number; skipped: number; errors: number }> {
    if (running) return { sent: 0, skipped: 0, errors: 0 };
    running = true; const started = Date.now(); const current = () => now + Math.max(0, Date.now() - started);
    let sent = 0; let skipped = 0; let errors = 0;
    try {
        await manager.recover(current());
        for (const userId of await manager.active()) {
            try {
                const claim = await manager.claim(userId, current);
                if (!claim) continue;
                let preview;
                try {
                    const [agenda, locale] = await Promise.all([loadMorningAgenda(userId, claim.timezone, current()), resolveUserOutputLocale(userId)]);
                    preview = formatMorningBriefing(agenda, locale);
                } catch (error) {
                    await manager.deliver(claim, current, async () => 'rejected'); throw error;
                }
                const result = await manager.deliver(claim, current, async stillEligible => {
                    if (preview.empty || preview.day !== claim.localDate || !stillEligible()) return 'skipped';
                    const result = await sendDirectMessagePayloadResult(userId, { content: preview.content, allowed_mentions: { parse: [] } });
                    return result.status === 'unknown' ? 'uncertain' : result.status;
                });
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
