import type { Attributes, CreationAttributes, WhereOptions } from 'sequelize';
import { col, fn, Op } from 'sequelize';
import { BaseManager } from './baseManager.js';
import { Notification } from '../models/notification.js';

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

    async has(provider: string, eventId: string): Promise<boolean> {
        return this.exists({ provider, eventId });
    }

    /**
     * Check if a notification exists scoped to a specific guild.
     * Does not require a unique constraint; returns true only if a record with matching provider, eventId and guildId exists.
     */
    async hasForGuild(provider: string, eventId: string, guildId: string): Promise<boolean> {
        return this.exists({ provider, eventId, guildId } as any);
    }

    async recordIfNew(entry: {
        provider: string;
        eventId: string;
        guildId?: string;
        channelId?: string;
        messageId?: string;
    }): Promise<{ created: boolean; record: Notification }>
    {
        const [record, created] = await this.findOrCreate({
            where: { provider: entry.provider, eventId: entry.eventId },
            defaults: entry as any
        });
        return { created, record };
    }

    /**
     * Upsert message metadata by (provider,eventId).
     * If a notification exists, updates its messageId/channelId/guildId; otherwise creates it.
     */
    async setMessageMeta(provider: string, eventId: string, meta: { messageId?: string; guildId?: string; channelId?: string }): Promise<void> {
        const where = { provider, eventId } as WhereOptions<Attributes<Notification>>;
        const existing = await this.model.findOne({ where });

        if (existing) {
            await existing.update(meta as Partial<CreationAttributes<Notification>>);
            return;
        }

        await this.addPlain({ provider, eventId, ...meta } as CreationAttributes<Notification>);
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
    const where: Partial<Record<keyof Attributes<Notification>, unknown>> = {};
    if (options.provider) where.provider = options.provider;
    if (options.guildId) where.guildId = options.guildId;
    return where as WhereOptions<Attributes<Notification>>;
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
        ...record,
        guildId: record.guildId ?? null,
        channelId: record.channelId ?? null,
        messageId: record.messageId ?? null,
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
