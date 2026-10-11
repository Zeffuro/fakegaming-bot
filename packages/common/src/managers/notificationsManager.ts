import type { Attributes, CreationAttributes, WhereOptions } from 'sequelize';
import { col, fn, Op, UniqueConstraintError } from 'sequelize';
import { BaseManager } from './baseManager.js';
import { Notification } from '../models/notification.js';
import { serializedTransaction } from './serializedTransaction.js';

export interface NotificationEntry {
    provider: string;
    eventId: string;
    guildId?: string | null;
    channelId?: string;
    messageId?: string;
}

export interface NotificationRecord {
    id?: number;
    provider: string;
    eventId: string;
    guildId?: string | null;
    channelId?: string | null;
    messageId?: string | null;
    createdAt?: Date | string | null;
    updatedAt?: Date | string | null;
}

export interface NotificationListOptions {
    provider?: string;
    guildId?: string;
    eventIdLike?: string;
    limit?: number;
    offset?: number;
    days?: number;
    now?: Date;
}

export interface UserBirthdayDeliveryListOptions {
    userId: string;
    limit?: number;
    offset?: number;
    days?: number;
    now?: Date;
}

export interface NotificationProviderSummary {
    provider: string;
    count: number;
}

export interface NotificationDailyTrendPoint {
    date: string;
    count: number;
}

export interface NotificationListResult {
    records: NotificationRecord[];
    total: number;
    limit: number;
    offset: number;
    summary: {
        total: number;
        byProvider: NotificationProviderSummary[];
        trend: NotificationDailyTrendPoint[];
    };
}

interface NotificationProviderSummaryRow {
    provider: string;
    count: number | string;
}

interface NotificationTrendRow {
    createdAt?: Date | string | null;
}

const defaultTrendDays = 7;
const maxTrendDays = 90;

export class NotificationsManager extends BaseManager<Notification> {
    constructor() {
        super(Notification);
    }

    async list(options: NotificationListOptions = {}): Promise<NotificationListResult> {
        const limit = clampLimit(options.limit);
        const offset = Math.max(0, Math.floor(options.offset ?? 0));
        const trendDays = clampTrendDays(options.days);
        const where = buildWhere(options);

        const [result, providerSummary, trend] = await Promise.all([
            this.model.findAndCountAll({
                where,
                order: [
                    ['createdAt', 'DESC'],
                    ['id', 'DESC'],
                ],
                limit,
                offset,
                raw: true,
            }),
            this.getProviderSummary(where),
            this.getDailyTrend(where, trendDays, options.now ?? new Date()),
        ]);

        return {
            records: (result.rows as unknown as NotificationRecord[]).map(normalizeRecord),
            total: result.count,
            limit,
            offset,
            summary: {
                total: result.count,
                byProvider: providerSummary,
                trend,
            },
        };
    }

    async listBirthdayDeliveriesForUser(options: UserBirthdayDeliveryListOptions): Promise<NotificationListResult> {
        const userId = normalizeEventIdSegment(options.userId);
        if (!userId) return buildEmptyListResult(options);

        return this.list({
            provider: 'birthday',
            eventIdLike: `%:${userId}:%`,
            limit: options.limit,
            offset: options.offset,
            days: options.days,
            now: options.now,
        });
    }

    async has(provider: string, eventId: string): Promise<boolean> {
        return this.exists({ provider, eventId });
    }

    async hasForGuild(provider: string, eventId: string, guildId: string): Promise<boolean> {
        return this.exists({ provider, eventId, scopeKey: guildId });
    }

    async getDeliveryStatus(provider: string, eventId: string, guildId: string | null | undefined,
        now: Date = new Date()): Promise<Notification['deliveryStatus'] | null> {
        const where = { provider, eventId, scopeKey: guildId ?? '' };
        // The sender has a 30-second deadline; expired claims remain non-replayable.
        await this.model.update({ deliveryStatus: 'uncertain' }, {
            where: { ...where, deliveryStatus: 'sending', createdAt: { [Op.lt]: new Date(now.getTime() - 45_000) } },
        });
        return (await this.model.findOne({ where }))?.deliveryStatus ?? null;
    }

    async recordIfNew(entry: NotificationEntry): Promise<{ created: boolean; record: Notification }> {
        return this.recordScoped(entry, 'sent');
    }

    async claimDelivery(entry: NotificationEntry): Promise<boolean> {
        return (await this.recordScoped(entry, 'sending')).created;
    }

    async finishDelivery(provider: string, eventId: string, guildId: string | null | undefined,
        result: { status: 'sent' | 'uncertain'; messageId?: string }): Promise<void> {
        await this.model.update({ deliveryStatus: result.status, ...(result.messageId === undefined ? {} : { messageId: result.messageId }) }, {
            where: { provider, eventId, scopeKey: guildId ?? '', deliveryStatus: 'sending' },
        });
    }

    async releaseDelivery(provider: string, eventId: string, guildId: string | null | undefined): Promise<void> {
        await this.model.destroy({ where: { provider, eventId, scopeKey: guildId ?? '', deliveryStatus: 'sending' } });
    }

    async setMessageMeta(provider: string, eventId: string, meta: { messageId?: string; guildId?: string; channelId?: string }): Promise<void> {
        const { record } = await this.recordIfNew({ provider, eventId, ...meta });
        await record.update(meta as Partial<CreationAttributes<Notification>>);
    }

    private async recordScoped(entry: NotificationEntry, deliveryStatus: Notification['deliveryStatus']): Promise<{ created: boolean; record: Notification }> {
        const where = { provider: entry.provider, eventId: entry.eventId, scopeKey: entry.guildId ?? '' };
        const defaults = { ...entry, scopeKey: where.scopeKey, deliveryStatus } as CreationAttributes<Notification>;
        const database = this.model.sequelize!;
        try {
            const [record, created] = database.getDialect() === 'sqlite'
                ? await serializedTransaction(database, transaction => this.model.findOrCreate({ where, defaults, transaction }))
                : await this.model.findOrCreate({ where, defaults });
            return { record, created };
        } catch (error) {
            if (!(error instanceof UniqueConstraintError)) throw error;
            const record = await this.model.findOne({ where });
            if (!record) throw error;
            return { record, created: false };
        }
    }

    private async getProviderSummary(where: WhereOptions<Attributes<Notification>>): Promise<NotificationProviderSummary[]> {
        const rows = await this.model.findAll({
            attributes: ['provider', [fn('COUNT', col('id')), 'count']],
            where,
            group: ['provider'],
            order: [[fn('COUNT', col('id')), 'DESC']],
            raw: true,
        });

        return (rows as unknown as NotificationProviderSummaryRow[]).map(row => ({
            provider: row.provider,
            count: Number(row.count),
        }));
    }

    private async getDailyTrend(
        where: WhereOptions<Attributes<Notification>>,
        days: number,
        now: Date
    ): Promise<NotificationDailyTrendPoint[]> {
        const window = buildTrendWindow(now, days);
        const counts = new Map(window.dates.map((date): [string, number] => [date, 0]));
        const trendWhere = {
            ...(where as Record<string, unknown>),
            createdAt: {
                [Op.gte]: window.start,
                [Op.lt]: window.endExclusive,
            },
        } as WhereOptions<Attributes<Notification>>;

        const rows = await this.model.findAll({
            attributes: ['createdAt'],
            where: trendWhere,
            order: [['createdAt', 'ASC']],
            raw: true,
        });

        for (const row of rows as unknown as NotificationTrendRow[]) {
            if (!row.createdAt) continue;
            const parsed = new Date(row.createdAt);
            if (Number.isNaN(parsed.getTime())) continue;
            const key = formatUtcDate(parsed);
            if (!counts.has(key)) continue;
            counts.set(key, (counts.get(key) ?? 0) + 1);
        }

        return [...counts.entries()].map(([date, count]) => ({ date, count }));
    }
}

function buildWhere(options: NotificationListOptions): WhereOptions<Attributes<Notification>> {
    const where: Partial<Record<keyof Attributes<Notification>, unknown>> = { deliveryStatus: 'sent' };
    if (options.provider) where.provider = options.provider;
    if (options.guildId) where.guildId = options.guildId;
    if (options.eventIdLike) where.eventId = { [Op.like]: options.eventIdLike };
    return where as WhereOptions<Attributes<Notification>>;
}

function buildEmptyListResult(options: Omit<UserBirthdayDeliveryListOptions, 'userId'>): NotificationListResult {
    const limit = clampLimit(options.limit);
    const offset = Math.max(0, Math.floor(options.offset ?? 0));
    const trendDays = clampTrendDays(options.days);
    const window = buildTrendWindow(options.now ?? new Date(), trendDays);

    return {
        records: [],
        total: 0,
        limit,
        offset,
        summary: {
            total: 0,
            byProvider: [],
            trend: window.dates.map(date => ({ date, count: 0 })),
        },
    };
}

function normalizeEventIdSegment(value: string): string | null {
    const trimmed = value.trim();
    if (!trimmed || /[%_:]/.test(trimmed)) return null;
    return trimmed;
}

function clampLimit(value: number | undefined): number {
    if (value === undefined) return 50;
    if (!Number.isFinite(value)) return 50;
    return Math.max(1, Math.min(100, Math.floor(value)));
}

function clampTrendDays(value: number | undefined): number {
    if (value === undefined) return defaultTrendDays;
    if (!Number.isFinite(value)) return defaultTrendDays;
    return Math.max(1, Math.min(maxTrendDays, Math.floor(value)));
}

function normalizeRecord(record: NotificationRecord): NotificationRecord {
    return {
        id: record.id,
        provider: record.provider,
        eventId: record.eventId,
        guildId: record.guildId ?? null,
        channelId: record.channelId ?? null,
        messageId: record.messageId ?? null,
        createdAt: record.createdAt,
        updatedAt: record.updatedAt,
    };
}

function buildTrendWindow(now: Date, days: number): { start: Date; endExclusive: Date; dates: string[] } {
    const safeNow = Number.isNaN(now.getTime()) ? new Date() : now;
    const end = startOfUtcDay(safeNow);
    const start = new Date(end);
    start.setUTCDate(end.getUTCDate() - days + 1);

    const endExclusive = new Date(end);
    endExclusive.setUTCDate(end.getUTCDate() + 1);

    const dates: string[] = [];
    for (let index = 0; index < days; index += 1) {
        const date = new Date(start);
        date.setUTCDate(start.getUTCDate() + index);
        dates.push(formatUtcDate(date));
    }

    return { start, endExclusive, dates };
}

function startOfUtcDay(value: Date): Date {
    return new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate()));
}

function formatUtcDate(value: Date): string {
    return value.toISOString().slice(0, 10);
}
