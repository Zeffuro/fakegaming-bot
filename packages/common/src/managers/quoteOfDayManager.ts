import type { CreationAttributes } from 'sequelize';
import { BaseManager } from './baseManager.js';
import { QuoteOfDayConfig } from '../models/quote-of-day-config.js';

export interface QuoteOfDayConfigInput {
    guildId: string;
    channelId: string;
    enabled?: boolean;
    runHourUtc?: number;
}

type RawQuoteOfDayConfigRecord = Omit<CreationAttributes<QuoteOfDayConfig>, 'enabled' | 'runHourUtc'> & {
    enabled?: boolean | number | null;
    runHourUtc?: number | string | null;
    createdAt?: Date | string | null;
    updatedAt?: Date | string | null;
};

export interface QuoteOfDayConfigRecord {
    guildId: string;
    channelId: string;
    enabled: boolean;
    runHourUtc: number;
    createdAt?: Date | string | null;
    updatedAt?: Date | string | null;
}

export class QuoteOfDayManager extends BaseManager<QuoteOfDayConfig> {
    constructor() {
        super(QuoteOfDayConfig);
    }

    async getForGuild(guildId: string): Promise<QuoteOfDayConfigRecord | null> {
        const record = await this.getOnePlain({ guildId });
        return record ? normalizeRecord(record as RawQuoteOfDayConfigRecord) : null;
    }

    async upsertForGuild(input: QuoteOfDayConfigInput): Promise<QuoteOfDayConfigRecord> {
        const record = {
            guildId: input.guildId,
            channelId: input.channelId,
            enabled: input.enabled ?? false,
            runHourUtc: normalizeRunHour(input.runHourUtc),
        } as CreationAttributes<QuoteOfDayConfig>;

        await this.upsert(record, ['guildId']);
        const updated = await this.getForGuild(input.guildId);
        if (!updated) throw new Error('Quote-of-the-day settings were not saved');
        return updated;
    }

    async listEnabledForHour(runHourUtc: number): Promise<QuoteOfDayConfigRecord[]> {
        const records = await this.getManyPlain({
            enabled: true,
            runHourUtc: normalizeRunHour(runHourUtc),
        });
        return records.map((record) => normalizeRecord(record as RawQuoteOfDayConfigRecord));
    }
}

function normalizeRecord(record: RawQuoteOfDayConfigRecord): QuoteOfDayConfigRecord {
    return {
        guildId: String(record.guildId),
        channelId: String(record.channelId),
        enabled: Boolean(record.enabled),
        runHourUtc: normalizeRunHour(Number(record.runHourUtc)),
        createdAt: record.createdAt ?? null,
        updatedAt: record.updatedAt ?? null,
    };
}

function normalizeRunHour(value: number | undefined): number {
    if (value === undefined || !Number.isFinite(value)) return 9;
    return Math.max(0, Math.min(23, Math.floor(value)));
}
