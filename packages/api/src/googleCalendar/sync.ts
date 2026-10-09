import { getConfigManager, serializedTransaction } from '@zeffuro/fakegaming-common/managers';
import { CalendarConnection, CalendarSource } from '@zeffuro/fakegaming-common/models';
import { formatMinuteKey, scheduleSingleton, type JobQueue } from '@zeffuro/fakegaming-common/jobs';
import { fetchGoogleOccurrences } from './client.js';
import { recordJobRun } from '../jobs/status.js';
import { apiText, resolveUserOutputLocale } from '../localization/locale.js';
import { CalendarError } from './auth.js';

const DAY = 86_400_000;
let running = false;

export async function syncCalendarSource(source: CalendarSource, now = Date.now()): Promise<void> {
    const expectedVersion = source.version;
    const version = await serializedTransaction(CalendarSource.sequelize!, async transaction => {
        const connection = await CalendarConnection.findByPk(source.userId, { transaction, lock: transaction.LOCK.UPDATE });
        const current = await CalendarSource.findOne({ where: { id: source.id, userId: source.userId, enabled: true,
            version: expectedVersion }, transaction, lock: transaction.LOCK.UPDATE });
        if (connection?.status !== 'connected') throw new CalendarError('not_connected');
        if (!current) throw new CalendarError('conflict');
        // Reserve before fetching so a late snapshot cannot replace a newer request, including same-millisecond requests.
        await current.update({ version: current.version + 1 }, { transaction });
        return current.version;
    });
    source.version = version;
    const windowStart = now - 14 * DAY;
    const windowEnd = now + 366 * DAY;
    const events = await fetchGoogleOccurrences(source.userId, source.calendarId, source.timezone, windowStart, windowEnd);
    const filter = source.titleFilter?.normalize('NFKC').toLocaleLowerCase('en').trim();
    const locale = await resolveUserOutputLocale(source.userId);
    const selected = (filter ? events.filter(event => event.cancelled || event.title.normalize('NFKC').toLocaleLowerCase('en').includes(filter)) : events)
        .map(event => ({ ...event, title: event.title.trim().slice(0, 160) || apiText(locale, 'calendarUntitledEvent') }));
    await getConfigManager().userScheduleManager.syncSource(source.id, source.userId, selected, windowStart, windowEnd, now, version);
}

export async function processGoogleCalendars(now = Date.now()): Promise<{ synced: number; errors: number }> {
    if (running) return { synced: 0, errors: 0 };
    running = true;
    try {
        const sources = await CalendarSource.findAll({ where: { enabled: true }, order: [['userId', 'ASC'], ['id', 'ASC']] });
        let synced = 0;
        let errors = 0;
        for (const source of sources) {
            if (source.lastSyncedAt !== null && Number(source.lastSyncedAt) > now - 15 * 60_000) continue;
            try { await syncCalendarSource(source, now); synced += 1; } catch { errors += 1; }
        }
        return { synced, errors };
    } finally { running = false; }
}

export async function registerGoogleCalendarJobs(queue: JobQueue): Promise<void> {
    queue.on('google-calendar:sync', async job => {
        const startedAt = new Date().toISOString();
        try {
            const result = await processGoogleCalendars();
            recordJobRun('google-calendar', { startedAt, finishedAt: new Date().toISOString(), ok: result.errors === 0, meta: result });
        } catch {
            recordJobRun('google-calendar', { startedAt, finishedAt: new Date().toISOString(), ok: false, error: 'Calendar synchronization failed' });
        } finally {
            try { await scheduleSingleton(queue, 'google-calendar:sync', {}, 60, `google-calendar:${formatMinuteKey(new Date(Date.now() + 60_000))}`); }
            finally { await job.done(); }
        }
    });
    await scheduleSingleton(queue, 'google-calendar:sync', {}, 5, `google-calendar:init:${formatMinuteKey(new Date())}`);
}
