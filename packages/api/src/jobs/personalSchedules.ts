import { getConfigManager, ScheduleNotificationManager, type ScheduleRecord } from '@zeffuro/fakegaming-common/managers';
import { getOutputLocaleMetadata, type SupportedOutputLocale } from '@zeffuro/fakegaming-common';
import { formatMinuteKey, scheduleSingleton, type JobQueue } from '@zeffuro/fakegaming-common/jobs';
import { apiText, resolveUserOutputLocale } from '../localization/locale.js';
import { recordJobRun } from './status.js';
import { sendScheduleMessage, editScheduleMessage } from './scheduleDiscord.js';

const manager = new ScheduleNotificationManager();
let running = false;

export function schedulePayload(row: ScheduleRecord, locale: SupportedOutputLocale): Record<string, unknown> {
    const time = (timestamp: number) => new Intl.DateTimeFormat(getOutputLocaleMetadata(locale).formatTag, {
        timeZone: row.timezone, dateStyle: 'medium', timeStyle: 'short',
    }).format(timestamp);
    const lines = [row.title, apiText(locale, 'schedulePlanned', { time: time(row.plannedAt), timezone: row.timezone }),
        row.completedAt === null ? apiText(locale, 'schedulePending') : apiText(locale, 'scheduleCompleted', { time: time(row.completedAt) })];
    if (row.cancelled) lines.push(apiText(locale, 'scheduleCancelled'));
    if (row.allDay) lines.push(apiText(locale, 'scheduleAllDay'));
    if (row.note) lines.push(row.note);
    const button = (action: string, key: 'scheduleTaken' | 'scheduleEarlier' | 'scheduleLater' | 'scheduleHistory' | 'scheduleUndo' | 'scheduleNote', style = 2) => ({
        type: 2, style, label: apiText(locale, key), custom_id: `schedule:${action}:${row.id}:${row.version}`,
    });
    const controls = row.state === 'completed' ? [button('u', 'scheduleUndo'), button('t', 'scheduleEarlier')]
        : row.cancelled ? [] : [button('d', 'scheduleTaken', 3), button('t', 'scheduleEarlier'), button('s', 'scheduleLater')];
    return { content: lines.join('\n').slice(0, 2000), allowed_mentions: { parse: [] }, components: [
        ...(controls.length ? [{ type: 1, components: controls }] : []),
        { type: 1, components: [button('h', 'scheduleHistory'), button('n', 'scheduleNote')] },
    ] };
}

export async function processPersonalSchedules(now = Date.now()): Promise<{ sent: number; edited: number; errors: number }> {
    if (running) return { sent: 0, edited: 0, errors: 0 };
    running = true;
    const startedAt = Date.now();
    const deliveryNow = () => now + Math.max(0, Date.now() - startedAt);
    let sent = 0;
    let edited = 0;
    let errors = 0;
    try {
        await getConfigManager().userScheduleManager.ensureManual();
        await manager.recover(now);
        for (const row of await manager.due(now)) {
            try {
                const locale = await resolveUserOutputLocale(row.userId);
                const claim = await manager.claim(row, deliveryNow);
                if (!claim) continue;
                const result = await sendScheduleMessage(row.userId, schedulePayload(row, locale));
                await manager.settle(claim.id, result.status, deliveryNow(),
                    result.status === 'sent' ? result.messageId : undefined, result.status === 'sent' ? result.channelId : undefined);
                if (result.status === 'sent') sent += 1;
                else errors += 1;
            } catch { errors += 1; }
        }
        for (const { notification, occurrence } of await manager.messagesToRefresh()) {
            try {
                const locale = await resolveUserOutputLocale(occurrence.userId);
                const result = await editScheduleMessage(notification.channelId!, notification.messageId!, schedulePayload(occurrence, locale));
                if (result !== 'retry') {
                    await manager.rendered(notification.id, occurrence.version, result === 'missing');
                    if (result === 'edited') edited += 1;
                } else errors += 1;
            } catch { errors += 1; }
        }
        return { sent, edited, errors };
    } finally { running = false; }
}

export async function registerPersonalScheduleJobs(queue: JobQueue): Promise<void> {
    queue.on('personal-schedules:run', async job => {
        const startedAt = new Date().toISOString();
        try {
            const result = await processPersonalSchedules();
            recordJobRun('personal-schedules', { startedAt, finishedAt: new Date().toISOString(), ok: result.errors === 0, meta: result });
        } catch {
            recordJobRun('personal-schedules', { startedAt, finishedAt: new Date().toISOString(), ok: false, error: 'Private schedule processing failed' });
        } finally {
            try { await scheduleSingleton(queue, 'personal-schedules:run', {}, 60, `personal-schedules:${formatMinuteKey(new Date(Date.now() + 60_000))}`); }
            finally { await job.done(); }
        }
    });
    await scheduleSingleton(queue, 'personal-schedules:run', {}, 5, `personal-schedules:init:${formatMinuteKey(new Date())}`);
}
