import { randomUUID } from 'node:crypto';
import { Op, type Transaction, type WhereOptions } from 'sequelize';
import { PersonalNotificationHistory } from '../models/personal-notification-history.js';
import { UserConfig } from '../models/user-config.js';
import { NOTIFICATION_HISTORY_KINDS, NOTIFICATION_HISTORY_REASONS, NOTIFICATION_HISTORY_STATUSES,
    type NotificationHistoryEntry, type NotificationHistoryKind, type NotificationHistoryPage,
    type NotificationHistoryReason, type NotificationHistoryStatus } from '../api/notificationHistory.js';
import { serializedTransaction } from './serializedTransaction.js';

export const NOTIFICATION_HISTORY_RETENTION_DAYS = 90;
export const NOTIFICATION_HISTORY_OWNER_LIMIT = 1000;
const retentionMs = NOTIFICATION_HISTORY_RETENTION_DAYS * 86_400_000;
const snowflake = /^[1-9]\d{16,19}$/;
const isSnowflake = (value: unknown): value is string => typeof value === 'string' && snowflake.test(value) && BigInt(value) <= 18_446_744_073_709_551_615n;

export interface NotificationHistoryInput {
    userId: string;
    kind: NotificationHistoryKind;
    occurrenceKey: string;
    title: string;
    status: NotificationHistoryStatus;
    reason?: NotificationHistoryReason | null;
    scheduledAt: number;
    observedAt?: number;
    sentAt?: number | null;
    messageId?: string | null;
    channelId?: string | null;
    transaction?: Transaction;
}

export interface NotificationHistoryFilters {
    kind?: NotificationHistoryKind;
    status?: NotificationHistoryStatus;
    offset?: number;
    limit?: number;
}

export class PersonalNotificationHistoryManager {
    private lastPrunedAt: number | null = null;
    constructor(private readonly now: () => number = Date.now) {}

    async record(input: NotificationHistoryInput): Promise<void> {
        const observedAt = input.observedAt ?? this.now();
        if (typeof input.userId !== 'string' || !input.userId || input.userId.length > 32
            || typeof input.occurrenceKey !== 'string' || !input.occurrenceKey || input.occurrenceKey.length > 256
            || typeof input.title !== 'string' || input.title.length > 200 || !NOTIFICATION_HISTORY_KINDS.includes(input.kind)
            || !NOTIFICATION_HISTORY_STATUSES.includes(input.status)
            || (input.reason != null && !NOTIFICATION_HISTORY_REASONS.includes(input.reason))
            || !Number.isSafeInteger(input.scheduledAt) || input.scheduledAt < 0 || !Number.isSafeInteger(observedAt) || observedAt < 0
            || (input.sentAt != null && (!Number.isSafeInteger(input.sentAt) || input.sentAt < 0))) throw new Error('Invalid notification history');
        if (!input.transaction) await this.prune();
        const write = async (transaction: Transaction) => {
            await UserConfig.findOrCreate({ where: { discordId: input.userId }, defaults: { discordId: input.userId }, transaction });
            await UserConfig.findByPk(input.userId, { transaction, lock: transaction.LOCK.UPDATE });
            await PersonalNotificationHistory.destroy({ where: { userId: input.userId, updatedAt: { [Op.lt]: this.now() - retentionMs } }, transaction });
            const where = { userId: input.userId, kind: input.kind, occurrenceKey: input.occurrenceKey };
            const row = await PersonalNotificationHistory.findOne({ where, transaction, lock: transaction.LOCK.UPDATE });
            // Confirmed and ambiguous sends cannot be downgraded by a stale poll or rejected worker.
            if (row && (row.status === 'sent' || row.status === 'uncertain'
                || (Number(row.updatedAt) > observedAt && input.status !== 'sent' && input.status !== 'uncertain'))) return;
            const values = { ...where, title: input.title, status: input.status, reason: input.reason ?? null,
                scheduledAt: row ? Number(row.scheduledAt) : input.scheduledAt, updatedAt: Math.max(observedAt, Number(row?.updatedAt ?? observedAt)),
                sentAt: input.status === 'sent' ? input.sentAt ?? observedAt : null,
                messageId: input.status === 'sent' && isSnowflake(input.messageId) ? input.messageId : null,
                channelId: input.status === 'sent' && isSnowflake(input.channelId) ? input.channelId : null };
            if (row) {
                if (row.status === values.status && row.reason === values.reason && row.title === values.title) return;
                await row.update(values, { transaction });
            } else await PersonalNotificationHistory.create({ id: randomUUID(), ...values }, { transaction });
            const overflow = await PersonalNotificationHistory.findAll({ where: { userId: input.userId }, attributes: ['id'],
                order: [['updatedAt', 'DESC'], ['id', 'DESC']], offset: NOTIFICATION_HISTORY_OWNER_LIMIT, transaction });
            if (overflow.length) await PersonalNotificationHistory.destroy({ where: { userId: input.userId, id: { [Op.in]: overflow.map(value => value.id) } }, transaction });
        };
        if (input.transaction) await write(input.transaction);
        else await serializedTransaction(PersonalNotificationHistory.sequelize!, write);
    }

    async list(userId: string, filters: NotificationHistoryFilters = {}): Promise<NotificationHistoryPage> {
        const offset = filters.offset ?? 0; const limit = filters.limit ?? 20;
        if (typeof userId !== 'string' || !userId || userId.length > 32 || !Number.isSafeInteger(offset) || offset < 0 || !Number.isSafeInteger(limit) || limit < 1 || limit > 100
            || (filters.kind !== undefined && !NOTIFICATION_HISTORY_KINDS.includes(filters.kind))
            || (filters.status !== undefined && !NOTIFICATION_HISTORY_STATUSES.includes(filters.status))) throw new Error('Invalid notification history filters');
        const where: WhereOptions = { userId, updatedAt: { [Op.gte]: this.now() - retentionMs },
            ...(filters.kind ? { kind: filters.kind } : {}), ...(filters.status ? { status: filters.status } : {}) };
        const result = await PersonalNotificationHistory.findAndCountAll({ where, order: [['updatedAt', 'DESC'], ['id', 'DESC']], offset, limit });
        return { items: result.rows.map(historyEntry), total: result.count, offset, limit, retentionDays: 90 };
    }

    private async prune(): Promise<void> {
        const current = this.now();
        if (this.lastPrunedAt !== null && Math.abs(current - this.lastPrunedAt) < 3_600_000) return;
        await serializedTransaction(PersonalNotificationHistory.sequelize!, transaction =>
            PersonalNotificationHistory.destroy({ where: { updatedAt: { [Op.lt]: current - retentionMs } }, transaction }));
        this.lastPrunedAt = current;
    }
}

function historyEntry(row: PersonalNotificationHistory): NotificationHistoryEntry {
    return { id: row.id, kind: row.kind, status: row.status, reason: row.reason, title: row.title,
        scheduledAt: Number(row.scheduledAt), updatedAt: Number(row.updatedAt), sentAt: row.sentAt === null ? null : Number(row.sentAt),
        messageUrl: row.status === 'sent' && isSnowflake(row.messageId) && isSnowflake(row.channelId)
            ? `https://discord.com/channels/@me/${row.channelId}/${row.messageId}` : null };
}
