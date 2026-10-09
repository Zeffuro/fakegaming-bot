import { randomUUID } from 'node:crypto';
import { Op, type Transaction } from 'sequelize';
import { CalendarConnection, CalendarSource } from '../models/calendar-connection.js';
import { PersonalSchedule, ScheduleNotification, ScheduleOccurrence, SchedulePreferences } from '../models/personal-schedule.js';
import { serializedTransaction } from './serializedTransaction.js';
import { followInQuietHours } from './userFollowManager.js';
import { occurrenceRecord, type ScheduleRecord } from './scheduleShared.js';

export class ScheduleNotificationManager {
    async due(now = Date.now()): Promise<ScheduleRecord[]> {
        const [enabledParents, activeSources, connections, preferences] = await Promise.all([
            PersonalSchedule.findAll({ where: { enabled: true } }), CalendarSource.findAll({ where: { enabled: true } }),
            CalendarConnection.findAll({ where: { status: 'connected' } }), SchedulePreferences.findAll({ where: { quietStart: { [Op.ne]: null } } }),
        ]);
        const connectedUsers = new Set(connections.map(connection => connection.userId));
        const activeSourceIds = new Set(activeSources.filter(source => connectedUsers.has(source.userId)).map(source => source.id));
        const quietUsers = new Set(preferences.filter(prefs => followInQuietHours({ timezone: prefs.timezone, quietStart: prefs.quietStart,
            quietEnd: prefs.quietEnd, digestAt: '09:00', lastDigestDate: null }, now)).map(prefs => prefs.userId));
        const parents = enabledParents.filter(parent => !quietUsers.has(parent.userId) && (parent.sourceId === null || activeSourceIds.has(parent.sourceId)));
        const sources = new Map(parents.map(row => [row.id, row.sourceId]));
        const rows = await ScheduleOccurrence.findAll({ where: { state: 'pending', cancelled: false, nextNotifyAt: { [Op.lte]: now },
            scheduleId: { [Op.in]: parents.map(parent => parent.id) } }, order: [['nextNotifyAt', 'ASC']], limit: 100 });
        return rows.map(row => occurrenceRecord(row, sources.get(row.scheduleId) ?? null));
    }

    async claim(record: ScheduleRecord, clock: number | (() => number) = Date.now): Promise<ScheduleNotification | null> {
        return this.transaction(async transaction => {
            if (record.sourceId) {
                const connection = await CalendarConnection.findByPk(record.userId, { transaction, lock: transaction.LOCK.UPDATE });
                const source = await CalendarSource.findOne({ where: { id: record.sourceId, userId: record.userId, enabled: true }, transaction, lock: transaction.LOCK.UPDATE });
                if (connection?.status !== 'connected' || !source) return null;
            }
            const parent = await PersonalSchedule.findOne({ where: { id: record.scheduleId, userId: record.userId, enabled: true }, transaction, lock: transaction.LOCK.UPDATE });
            const row = await ScheduleOccurrence.findOne({ where: { id: record.id, userId: record.userId }, transaction, lock: transaction.LOCK.UPDATE });
            if (!parent || !row || row.state !== 'pending' || row.cancelled || row.version !== record.version || row.nextNotifyAt === null) return null;
            const prefs = await SchedulePreferences.findByPk(record.userId, { transaction, lock: transaction.LOCK.UPDATE });
            const now = typeof clock === 'function' ? clock() : clock;
            if (Number(row.nextNotifyAt) > now) return null;
            if (prefs && followInQuietHours({ timezone: prefs.timezone, quietStart: prefs.quietStart, quietEnd: prefs.quietEnd, digestAt: '09:00', lastDigestDate: null }, now)) return null;
            if (row.notificationCount >= 1 + (prefs?.maxFollowups ?? 0)) { await row.update({ nextNotifyAt: null }, { transaction }); return null; }
            const attemptKey = `${row.id}:${row.notificationEpoch}:${row.notificationCount}`;
            let attempt = await ScheduleNotification.findOne({ where: { attemptKey }, transaction });
            if (attempt) {
                if (attempt.status !== 'rejected') return null;
                await attempt.update({ status: 'sending', attemptedAt: now, renderedVersion: row.version, scheduledAt: row.nextNotifyAt }, { transaction });
            } else attempt = await ScheduleNotification.create({ id: randomUUID(), userId: row.userId, occurrenceId: row.id,
                attemptKey, status: 'sending', attemptedAt: now, messageId: null, channelId: null, renderedVersion: row.version,
                notificationEpoch: row.notificationEpoch, scheduledAt: row.nextNotifyAt }, { transaction });
            return attempt;
        });
    }

    async settle(id: string, result: 'sent' | 'rejected' | 'uncertain', now = Date.now(), messageId?: string, channelId?: string): Promise<void> {
        await this.transaction(async transaction => {
            const attempt = await ScheduleNotification.findByPk(id, { transaction });
            if (!attempt || attempt.status !== 'sending') return;
            const pointer = await ScheduleOccurrence.findByPk(attempt.occurrenceId, { transaction });
            if (!pointer) return;
            await PersonalSchedule.findByPk(pointer.scheduleId, { transaction, lock: transaction.LOCK.UPDATE });
            const row = await ScheduleOccurrence.findByPk(pointer.id, { transaction, lock: transaction.LOCK.UPDATE });
            const [changed] = await ScheduleNotification.update({ status: result, ...(result === 'sent' ? { messageId: messageId ?? null, channelId: channelId ?? null } : {}) },
                { where: { id, status: 'sending' }, transaction });
            if (!changed || !row || row.notificationEpoch !== attempt.notificationEpoch) return;
            if (result === 'rejected') {
                if (row.state === 'pending' && !row.cancelled) await row.update({ nextNotifyAt: now + 5 * 60_000 }, { transaction });
                return;
            }
            const prefs = await SchedulePreferences.findByPk(row.userId, { transaction });
            const count = row.notificationCount + 1;
            const nextNotifyAt = row.state === 'pending' && !row.cancelled
                && count <= (prefs?.maxFollowups ?? 0) && (prefs?.followupMinutes ?? 0) > 0 ? now + prefs!.followupMinutes * 60_000 : null;
            await row.update({ notificationCount: count, nextNotifyAt }, { transaction });
        });
    }

    async recover(now = Date.now()): Promise<void> {
        const interrupted = await ScheduleNotification.findAll({ where: { status: 'sending', attemptedAt: { [Op.lt]: now - 5 * 60_000 } } });
        for (const row of interrupted) await this.settle(row.id, 'uncertain', now);
    }

    async messagesToRefresh(limit = 100): Promise<Array<{ notification: ScheduleNotification; occurrence: ScheduleRecord }>> {
        const messages = await ScheduleNotification.findAll({ where: { status: 'sent', messageId: { [Op.ne]: null }, channelId: { [Op.ne]: null } }, order: [['updatedAt', 'ASC']] });
        const pending: Array<{ notification: ScheduleNotification; occurrence: ScheduleRecord }> = [];
        for (const notification of messages) {
            const row = await ScheduleOccurrence.findOne({ where: { id: notification.occurrenceId, userId: notification.userId } });
            if (!row || row.version === notification.renderedVersion) continue;
            const parent = await PersonalSchedule.findByPk(row.scheduleId);
            pending.push({ notification, occurrence: occurrenceRecord(row, parent?.sourceId ?? null) });
            if (pending.length >= limit) break;
        }
        return pending;
    }

    async rendered(id: string, version: number, missing = false): Promise<void> {
        await this.transaction(async transaction => {
            await ScheduleNotification.update(missing ? { messageId: null, channelId: null } : { renderedVersion: version }, { where: { id, status: 'sent' }, transaction });
        });
    }

    private async transaction<T>(action: (transaction: Transaction) => Promise<T>): Promise<T> {
        return serializedTransaction(ScheduleOccurrence.sequelize!, action);
    }
}
