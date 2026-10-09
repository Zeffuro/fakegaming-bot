import { randomUUID } from 'node:crypto';
import { Op, type Transaction } from 'sequelize';
import { PersonalSchedule, ScheduleOccurrence, SchedulePreferences } from '../models/personal-schedule.js';
import { CalendarSource } from '../models/calendar-connection.js';
import { CalendarPublication, CalendarPublicationDraft } from '../models/calendar-publication.js';
import { parseHHmmToMinutes } from '../utils/time.js';
import { serializedTransaction } from './serializedTransaction.js';
import { requirePersonalText } from './productivityShared.js';
import { nextScheduleWeek, occurrenceRecord, scheduleKey, ScheduleError, scheduleTimezone, type ImportedOccurrence, type ScheduleRecord, type ScheduleSettings } from './scheduleShared.js';
import { syncScheduleSource } from './scheduleSync.js';

export class UserScheduleManager {
    constructor(private readonly now: () => number = Date.now) {}

    async createManual(input: { userId: string; title: string; plannedAt: number; timezone: string; repeatWeeks?: number | null }): Promise<ScheduleRecord> {
        const title = requirePersonalText(input.title, 160);
        scheduleTimezone(input.timezone);
        const repeatWeeks = input.repeatWeeks ?? null;
        if (!input.userId || !Number.isSafeInteger(input.plannedAt) || input.plannedAt <= this.now() || input.plannedAt > this.now() + 3660 * 86_400_000
            || (repeatWeeks !== null && (!Number.isInteger(repeatWeeks) || repeatWeeks < 1 || repeatWeeks > 52))) throw new ScheduleError('invalid');
        return this.transaction(async transaction => {
            if (await PersonalSchedule.count({ where: { userId: input.userId, sourceId: null, enabled: true }, transaction }) >= 100) throw new ScheduleError('capacity');
            const schedule = await PersonalSchedule.create({ id: randomUUID(), userId: input.userId, sourceId: null, externalKey: null,
                title, timezone: input.timezone, anchorAt: input.plannedAt, repeatWeeks, enabled: true }, { transaction });
            await this.expandManual(schedule, transaction);
            const occurrence = await ScheduleOccurrence.findOne({ where: { scheduleId: schedule.id }, order: [['plannedAt', 'ASC']], transaction });
            return occurrenceRecord(occurrence!, null);
        });
    }

    async ensureManual(): Promise<void> {
        const schedules = await PersonalSchedule.findAll({ where: { sourceId: null, enabled: true } });
        for (const schedule of schedules) await this.transaction(async transaction => {
            const current = await PersonalSchedule.findByPk(schedule.id, { transaction, lock: transaction.LOCK.UPDATE });
            if (current?.enabled) await this.expandManual(current, transaction);
        });
    }

    async list(userId: string, filter: 'upcoming' | 'unconfirmed' | 'completed' | 'all' = 'upcoming', scheduleId?: string): Promise<ScheduleRecord[]> {
        const where = { userId, ...(scheduleId ? { scheduleId } : {}),
            ...(filter === 'completed' ? { state: 'completed' } : filter === 'all' ? {} : { state: 'pending', cancelled: false,
                plannedAt: { [filter === 'upcoming' ? Op.gte : Op.lte]: this.now() } }) };
        const rows = await ScheduleOccurrence.findAll({ where, order: [['plannedAt', filter === 'completed' ? 'DESC' : 'ASC']] });
        const schedules = await PersonalSchedule.findAll({ where: { userId } });
        const sources = new Map(schedules.map(schedule => [schedule.id, schedule.sourceId]));
        return rows.map(row => occurrenceRecord(row, sources.get(row.scheduleId) ?? null));
    }

    async get(id: string, userId: string): Promise<ScheduleRecord | null> {
        const row = await ScheduleOccurrence.findOne({ where: { id, userId } });
        if (!row) return null;
        const schedule = await PersonalSchedule.findOne({ where: { id: row.scheduleId, userId } });
        return occurrenceRecord(row, schedule?.sourceId ?? null);
    }

    async complete(id: string, userId: string, version: number, completedAt = this.now(), note?: string): Promise<ScheduleRecord> {
        if (!Number.isSafeInteger(completedAt) || completedAt <= 0 || completedAt > this.now() || (note !== undefined && note.length > 1000)) throw new ScheduleError('invalid');
        return this.mutate(id, userId, version, { state: 'completed', completedAt, nextNotifyAt: null, ...(note !== undefined ? { note } : {}) });
    }

    async undo(id: string, userId: string, version: number): Promise<ScheduleRecord> {
        return this.mutate(id, userId, version, { state: 'pending', completedAt: null, notificationCount: 0, nextNotifyAt: this.now() + 60_000 }, 'completed');
    }

    async snooze(id: string, userId: string, version: number, until: number): Promise<ScheduleRecord> {
        if (!Number.isSafeInteger(until) || until <= this.now() || until > this.now() + 366 * 86_400_000) throw new ScheduleError('invalid');
        return this.mutate(id, userId, version, { nextNotifyAt: until }, 'pending');
    }

    async note(id: string, userId: string, version: number, note: string): Promise<ScheduleRecord> {
        if (note.length > 1000) throw new ScheduleError('invalid');
        return this.mutate(id, userId, version, { note });
    }

    async setEnabled(scheduleId: string, userId: string, enabled: boolean): Promise<boolean> {
        return this.transaction(async transaction => {
            const [changed] = await PersonalSchedule.update({ enabled }, { where: { id: scheduleId, userId }, transaction });
            return changed === 1;
        });
    }

    async summary(userId: string, scheduleId: string): Promise<{ last: ScheduleRecord | null; next: ScheduleRecord | null; unconfirmed: number }> {
        const records = await this.list(userId, 'all', scheduleId);
        return { last: records.filter(row => row.completedAt !== null).sort((a, b) => b.completedAt! - a.completedAt!)[0] ?? null,
            next: records.find(row => row.plannedAt >= this.now() && row.state === 'pending' && !row.cancelled) ?? null,
            unconfirmed: records.filter(row => row.plannedAt <= this.now() && row.state === 'pending' && !row.cancelled).length };
    }

    async export(userId: string, format: 'json' | 'csv'): Promise<string> {
        return this.transaction(async transaction => {
            const rows = await ScheduleOccurrence.findAll({ where: { userId }, order: [['plannedAt', 'ASC']], transaction });
            const schedules = await PersonalSchedule.findAll({ where: { userId }, transaction });
            const sources = new Map(schedules.map(row => [row.id, row.sourceId]));
            const occurrences = rows.map(row => occurrenceRecord(row, sources.get(row.scheduleId) ?? null));
            if (format === 'json') return JSON.stringify({ formatVersion: 1, exportedAt: new Date(this.now()).toISOString(),
                schedules: schedules.map(row => ({ id: row.id, title: row.title, timezone: row.timezone, enabled: row.enabled,
                    sourceId: row.sourceId, anchorAt: row.anchorAt === null ? null : Number(row.anchorAt), repeatWeeks: row.repeatWeeks })), occurrences }, null, 2);
            const cell = (value: unknown) => {
                const text = String(value ?? '');
                return `"${(/^[=+\-@\t\r]/.test(text) ? `'${text}` : text).replaceAll('"', '""')}"`;
            };
            const columns = ['id', 'scheduleId', 'title', 'timezone', 'plannedAt', 'completedAt', 'state', 'cancelled', 'note'] as const;
            return [columns.join(','), ...occurrences.map(row => columns.map(column => cell(row[column])).join(','))].join('\r\n');
        });
    }

    async preferences(userId: string, fallbackTimezone = 'UTC'): Promise<ScheduleSettings> {
        scheduleTimezone(fallbackTimezone);
        return this.transaction(async transaction => {
            const [row] = await SchedulePreferences.findOrCreate({ where: { userId }, defaults: { userId, timezone: fallbackTimezone,
                quietStart: null, quietEnd: null, followupMinutes: 0, maxFollowups: 0 }, transaction });
            return { timezone: row.timezone, quietStart: row.quietStart, quietEnd: row.quietEnd, followupMinutes: row.followupMinutes, maxFollowups: row.maxFollowups };
        });
    }

    async configure(userId: string, input: ScheduleSettings): Promise<void> {
        scheduleTimezone(input.timezone);
        if ((input.quietStart === null) !== (input.quietEnd === null) || (input.quietStart !== null && parseHHmmToMinutes(input.quietStart) === null)
            || (input.quietEnd !== null && parseHHmmToMinutes(input.quietEnd) === null) || !Number.isInteger(input.followupMinutes)
            || input.followupMinutes < 0 || input.followupMinutes > 10080 || !Number.isInteger(input.maxFollowups) || input.maxFollowups < 0 || input.maxFollowups > 8
            || (input.maxFollowups > 0 && input.followupMinutes < 15)) throw new ScheduleError('invalid');
        await this.transaction(async transaction => {
            const row = await SchedulePreferences.findByPk(userId, { transaction });
            if (row) await row.update(input, { transaction });
            else await SchedulePreferences.create({ userId, ...input }, { transaction });
        });
    }

    async syncSource(sourceId: string, userId: string, events: ImportedOccurrence[], windowStart: number, windowEnd: number, observedAt: number, sourceVersion: number): Promise<void> {
        await this.transaction(transaction => syncScheduleSource({ sourceId, userId, events, windowStart, windowEnd, observedAt, sourceVersion }, transaction));
    }

    async deactivateSource(sourceId: string, userId: string): Promise<void> {
        await this.transaction(async transaction => {
            const source = await CalendarSource.findOne({ where: { id: sourceId, userId }, transaction, lock: transaction.LOCK.UPDATE });
            if (source) await source.update({ enabled: false, version: source.version + 1 }, { transaction });
            await CalendarPublicationDraft.destroy({ where: { userId }, transaction });
            const publications = await CalendarPublication.findAll({ where: { sourceId, userId, enabled: true }, transaction, lock: transaction.LOCK.UPDATE });
            for (const publication of publications) await publication.update({ enabled: false, version: publication.version + 1 }, { transaction });
        });
    }

    private async mutate(id: string, userId: string, version: number, values: Record<string, unknown>, state?: 'pending' | 'completed'): Promise<ScheduleRecord> {
        return this.transaction(async transaction => {
            const pointer = await ScheduleOccurrence.findOne({ where: { id, userId }, transaction });
            if (!pointer) throw new ScheduleError('missing');
            const schedule = await PersonalSchedule.findOne({ where: { id: pointer.scheduleId, userId }, transaction, lock: transaction.LOCK.UPDATE });
            const row = await ScheduleOccurrence.findOne({ where: { id, userId }, transaction, lock: transaction.LOCK.UPDATE });
            if (!schedule || !row) throw new ScheduleError('missing');
            if (row.version !== version || (state && row.state !== state)) throw new ScheduleError('stale');
            if (row.cancelled && values.state !== 'completed' && !Object.hasOwn(values, 'note')) values.nextNotifyAt = null;
            const resetNotifications = Object.hasOwn(values, 'nextNotifyAt') && values.nextNotifyAt !== null;
            await row.update({ ...values, ...(resetNotifications ? { notificationEpoch: row.notificationEpoch + 1, notificationCount: 0 } : {}), version: row.version + 1 }, { transaction });
            return occurrenceRecord(row, schedule.sourceId);
        });
    }

    private async expandManual(schedule: PersonalSchedule, transaction: Transaction): Promise<void> {
        const last = await ScheduleOccurrence.findOne({ where: { scheduleId: schedule.id }, order: [['plannedAt', 'DESC']], transaction });
        if (last && schedule.repeatWeeks === null) return;
        if (last && Number(last.plannedAt) >= this.now() + 366 * 86_400_000) return;
        let plannedAt = last ? nextScheduleWeek(Number(last.plannedAt), schedule.repeatWeeks!, schedule.timezone, Number(schedule.anchorAt)) : Number(schedule.anchorAt);
        const horizon = Math.max(this.now() + 366 * 86_400_000, Number(schedule.anchorAt));
        for (let count = 0; count < 60; count++) {
            await ScheduleOccurrence.findOrCreate({ where: { externalKey: scheduleKey(schedule.id, String(plannedAt)) }, defaults: {
                id: randomUUID(), userId: schedule.userId, scheduleId: schedule.id, externalKey: scheduleKey(schedule.id, String(plannedAt)), eventId: null,
                title: schedule.title, timezone: schedule.timezone, plannedAt, endAt: null, allDay: false, cancelled: false,
                state: 'pending', completedAt: null, note: '', version: 0, nextNotifyAt: plannedAt, notificationCount: 0,
            }, transaction });
            if (schedule.repeatWeeks === null || plannedAt >= horizon) break;
            plannedAt = nextScheduleWeek(plannedAt, schedule.repeatWeeks, schedule.timezone, Number(schedule.anchorAt));
        }
    }

    private async transaction<T>(action: (transaction: Transaction) => Promise<T>): Promise<T> {
        return serializedTransaction(PersonalSchedule.sequelize!, action);
    }
}
