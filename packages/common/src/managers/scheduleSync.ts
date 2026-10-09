import { randomUUID } from 'node:crypto';
import { Op, type Transaction } from 'sequelize';
import { CalendarConnection, CalendarSource } from '../models/calendar-connection.js';
import { CalendarEventSnapshot, CalendarEventSnapshotState } from '../models/calendar-publication.js';
import { PersonalSchedule, ScheduleOccurrence } from '../models/personal-schedule.js';
import { scheduleKey, scheduleTimezone, ScheduleError, type ImportedOccurrence } from './scheduleShared.js';
import { calendarDetailText, googleCalendarEventLink } from '../utils/calendarDetails.js';

export async function syncScheduleSource(input: {
    sourceId: string; userId: string; events: ImportedOccurrence[]; windowStart: number; windowEnd: number; observedAt: number; sourceVersion: number;
}, transaction: Transaction): Promise<void> {
    const { sourceId, userId, events, observedAt, windowStart, windowEnd } = input;
    if (!Number.isSafeInteger(windowStart) || !Number.isSafeInteger(windowEnd) || !Number.isSafeInteger(observedAt)
        || windowStart >= windowEnd || events.length > 10_000) throw new ScheduleError('invalid');
    const connection = await CalendarConnection.findByPk(userId, { transaction, lock: transaction.LOCK.UPDATE });
    const source = await CalendarSource.findOne({ where: { id: sourceId, userId, enabled: true, version: input.sourceVersion }, transaction, lock: transaction.LOCK.UPDATE });
    if (!source || connection?.status !== 'connected' || (source.lastSyncedAt !== null && Number(source.lastSyncedAt) > observedAt)) return;
    const seen = new Set<string>();
    for (const event of events) {
        if (!event.seriesKey || !event.occurrenceKey || !event.eventId || event.eventId.length > 1024) throw new ScheduleError('invalid');
        const externalKey = scheduleKey(sourceId, event.seriesKey, event.occurrenceKey);
        let existing = await ScheduleOccurrence.findOne({ where: { userId, externalKey }, transaction });
        if (!existing && event.cancelled) {
            const parents = await PersonalSchedule.findAll({ where: { sourceId, userId }, transaction });
            existing = await ScheduleOccurrence.findOne({ where: { userId, eventId: event.eventId,
                scheduleId: { [Op.in]: parents.map(parent => parent.id) } }, transaction });
        }
        if (event.cancelled) {
            if (existing) {
                seen.add(existing.externalKey); await updateCancellation(existing, true, transaction);
                await CalendarEventSnapshot.update({ cancelled: true }, { where: { id: existing.id, userId, sourceId }, transaction });
            }
            continue;
        }
        if (!Number.isSafeInteger(event.plannedAt) || event.plannedAt <= 0 || !event.title.trim() || event.title.length > 160
            || (event.endAt !== null && (!Number.isSafeInteger(event.endAt) || event.endAt < event.plannedAt))) throw new ScheduleError('invalid');
        scheduleTimezone(event.timezone);
        const seriesKey = scheduleKey(sourceId, event.seriesKey);
        let schedule = await PersonalSchedule.findOne({ where: { userId, externalKey: seriesKey }, transaction, lock: transaction.LOCK.UPDATE });
        if (!schedule) schedule = await PersonalSchedule.create({ id: randomUUID(), userId, sourceId, externalKey: seriesKey, title: event.title,
            timezone: event.timezone, enabled: true, repeatWeeks: null, anchorAt: null }, { transaction });
        else if (schedule.title !== event.title || schedule.timezone !== event.timezone) await schedule.update({ title: event.title, timezone: event.timezone }, { transaction });
        seen.add(externalKey);
        if (!existing) {
            existing = await ScheduleOccurrence.create({ id: randomUUID(), userId, scheduleId: schedule.id, externalKey, eventId: event.eventId,
                title: event.title, timezone: event.timezone, plannedAt: event.plannedAt, endAt: event.endAt, allDay: event.allDay,
                cancelled: false, state: 'pending', completedAt: null, note: '', version: 0,
                nextNotifyAt: event.plannedAt >= observedAt ? event.plannedAt : null, notificationCount: 0 }, { transaction });
        } else {
            await existing.reload({ transaction, lock: transaction.LOCK.UPDATE });
            const changed = existing.eventId !== event.eventId || existing.cancelled || (existing.state !== 'completed'
                && (Number(existing.plannedAt) !== event.plannedAt || existing.title !== event.title || existing.timezone !== event.timezone
                    || existing.allDay !== event.allDay || (existing.endAt === null ? null : Number(existing.endAt)) !== event.endAt));
            if (changed) {
                const snapshot = existing.state === 'completed' ? {} : { title: event.title, timezone: event.timezone, plannedAt: event.plannedAt,
                    endAt: event.endAt, allDay: event.allDay, ...(Number(existing.plannedAt) !== event.plannedAt || existing.cancelled
                        ? { nextNotifyAt: event.plannedAt, notificationEpoch: existing.notificationEpoch + 1, notificationCount: 0 } : {}) };
                await existing.update({ ...snapshot, eventId: event.eventId, cancelled: false, version: existing.version + 1 }, { transaction });
            }
        }
        // Public calendar dates follow the provider; completed private history keeps its original snapshot.
        await CalendarEventSnapshot.upsert({ id: existing.id, userId, sourceId, scheduleId: existing.scheduleId, eventId: event.eventId,
            title: event.title, timezone: event.timezone, plannedAt: event.plannedAt, endAt: event.endAt, allDay: event.allDay, cancelled: false,
            htmlLink: googleCalendarEventLink(event.htmlLink), location: calendarDetailText(event.location, 100),
            description: calendarDetailText(event.description, 1000) }, { transaction });
    }
    const schedules = await PersonalSchedule.findAll({ where: { sourceId, userId }, transaction });
    const candidates = await ScheduleOccurrence.findAll({ where: { userId, scheduleId: { [Op.in]: schedules.map(row => row.id) },
        plannedAt: { [Op.gte]: Math.max(windowStart, observedAt), [Op.lt]: windowEnd }, cancelled: false, state: 'pending' }, transaction });
    for (const row of candidates) if (!seen.has(row.externalKey)) await updateCancellation(row, true, transaction);
    const publicCandidates = await CalendarEventSnapshot.findAll({ where: { userId, sourceId, cancelled: false,
        plannedAt: { [Op.gte]: Math.max(windowStart, observedAt), [Op.lt]: windowEnd } }, transaction });
    const seenIds = new Set((await ScheduleOccurrence.findAll({ where: { userId, externalKey: { [Op.in]: [...seen] } }, attributes: ['id'], transaction })).map(row => row.id));
    for (const row of publicCandidates) if (!seenIds.has(row.id)) await row.update({ cancelled: true }, { transaction });
    await CalendarEventSnapshotState.upsert({ sourceId, userId, observedAt }, { transaction });
    await source.update({ lastSyncedAt: observedAt }, { transaction });
}

async function updateCancellation(row: ScheduleOccurrence, cancelled: boolean, transaction: Transaction): Promise<void> {
    await PersonalSchedule.findByPk(row.scheduleId, { transaction, lock: transaction.LOCK.UPDATE });
    await row.reload({ transaction, lock: transaction.LOCK.UPDATE });
    if (row.cancelled === cancelled) return;
    await row.update({ cancelled, nextNotifyAt: null, version: row.version + 1 }, { transaction });
}
