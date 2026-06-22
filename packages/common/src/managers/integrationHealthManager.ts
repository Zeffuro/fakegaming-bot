import type { Attributes, CreationAttributes, WhereOptions } from 'sequelize';
import { BaseManager } from './baseManager.js';
import {
    IntegrationHealth,
    INTEGRATION_HEALTH_STATUSES,
    type IntegrationHealthMetadata,
    type IntegrationHealthStatus,
} from '../models/integration-health.js';

const MAX_ERROR_MESSAGE_LENGTH = 512;

export interface IntegrationHealthRecord {
    id?: number;
    provider: string;
    configId: string;
    guildId?: string | null;
    channelId?: string | null;
    status: IntegrationHealthStatus;
    lastCheckedAt?: Date | string | null;
    lastSuccessAt?: Date | string | null;
    lastFailureAt?: Date | string | null;
    lastDeliveryAt?: Date | string | null;
    consecutiveFailures: number;
    lastErrorCode?: string | null;
    lastErrorMessage?: string | null;
    metadata?: IntegrationHealthMetadata | null;
    createdAt?: Date | string;
    updatedAt?: Date | string;
}

export interface IntegrationHealthSuccessInput {
    provider: string;
    configId: string | number;
    guildId?: string | null;
    channelId?: string | null;
    delivered?: boolean;
    status?: Exclude<IntegrationHealthStatus, 'error'>;
    metadata?: IntegrationHealthMetadata | null;
    checkedAt?: Date;
}

export interface IntegrationHealthFailureInput {
    provider: string;
    configId: string | number;
    guildId?: string | null;
    channelId?: string | null;
    errorCode: string;
    errorMessage: string;
    metadata?: IntegrationHealthMetadata | null;
    checkedAt?: Date;
}

export interface IntegrationHealthStatusInput {
    provider: string;
    configId: string | number;
    guildId?: string | null;
    channelId?: string | null;
    status: IntegrationHealthStatus;
    metadata?: IntegrationHealthMetadata | null;
    checkedAt?: Date;
}

export interface IntegrationHealthListOptions {
    provider?: string;
    guildId?: string;
    status?: IntegrationHealthStatus;
    limit?: number;
    offset?: number;
}

export interface IntegrationHealthSummary {
    total: number;
    healthy: number;
    warning: number;
    error: number;
    paused: number;
    unknown: number;
}

export interface IntegrationHealthListResult {
    records: IntegrationHealthRecord[];
    total: number;
    limit: number;
    offset: number;
    summary: IntegrationHealthSummary;
}

export class IntegrationHealthManager extends BaseManager<IntegrationHealth> {
    constructor() {
        super(IntegrationHealth);
    }

    async listForGuild(guildId: string, provider?: string): Promise<IntegrationHealthRecord[]> {
        const where = provider ? { guildId, provider } : { guildId };
        const rows = await this.getManyPlain(where);
        return (rows as unknown as IntegrationHealthRecord[]).map(normalizeRecord);
    }

    async getForConfig(provider: string, configId: string | number): Promise<IntegrationHealthRecord | null> {
        const row = await this.getOnePlain({ provider, configId: String(configId) });
        return row ? normalizeRecord(row as unknown as IntegrationHealthRecord) : null;
    }

    async list(options: IntegrationHealthListOptions = {}): Promise<IntegrationHealthListResult> {
        const limit = clampLimit(options.limit);
        const offset = Math.max(0, Math.floor(options.offset ?? 0));
        const baseWhere = buildWhere(options, false);
        const where = buildWhere(options, true);

        const [result, summary] = await Promise.all([
            this.model.findAndCountAll({
                where,
                order: [
                    ['status', 'ASC'],
                    ['lastCheckedAt', 'DESC'],
                    ['updatedAt', 'DESC'],
                ],
                limit,
                offset,
                raw: true,
            }),
            this.getSummary(baseWhere),
        ]);

        return {
            records: (result.rows as unknown as IntegrationHealthRecord[]).map(normalizeRecord),
            total: result.count,
            limit,
            offset,
            summary,
        };
    }

    async recordSuccess(input: IntegrationHealthSuccessInput): Promise<void> {
        const checkedAt = input.checkedAt ?? new Date();
        const payload: CreationAttributes<IntegrationHealth> = {
            provider: input.provider,
            configId: String(input.configId),
            guildId: input.guildId ?? null,
            channelId: input.channelId ?? null,
            status: input.status ?? 'healthy',
            lastCheckedAt: checkedAt,
            lastSuccessAt: checkedAt,
            lastFailureAt: null,
            lastDeliveryAt: input.delivered ? checkedAt : undefined,
            consecutiveFailures: 0,
            lastErrorCode: null,
            lastErrorMessage: null,
            metadata: input.metadata ?? null,
        } as CreationAttributes<IntegrationHealth>;

        await this.upsert(payload, ['provider', 'configId']);
    }

    async recordFailure(input: IntegrationHealthFailureInput): Promise<void> {
        const checkedAt = input.checkedAt ?? new Date();
        const existing = await this.getForConfig(input.provider, input.configId);
        const payload: CreationAttributes<IntegrationHealth> = {
            provider: input.provider,
            configId: String(input.configId),
            guildId: input.guildId ?? existing?.guildId ?? null,
            channelId: input.channelId ?? existing?.channelId ?? null,
            status: 'error',
            lastCheckedAt: checkedAt,
            lastSuccessAt: existing?.lastSuccessAt ?? null,
            lastFailureAt: checkedAt,
            lastDeliveryAt: existing?.lastDeliveryAt ?? null,
            consecutiveFailures: (existing?.consecutiveFailures ?? 0) + 1,
            lastErrorCode: normalizeErrorCode(input.errorCode),
            lastErrorMessage: truncateErrorMessage(input.errorMessage),
            metadata: input.metadata ?? existing?.metadata ?? null,
        } as CreationAttributes<IntegrationHealth>;

        await this.upsert(payload, ['provider', 'configId']);
    }

    async recordStatus(input: IntegrationHealthStatusInput): Promise<void> {
        const checkedAt = input.checkedAt ?? new Date();
        const existing = await this.getForConfig(input.provider, input.configId);
        const payload: CreationAttributes<IntegrationHealth> = {
            provider: input.provider,
            configId: String(input.configId),
            guildId: input.guildId ?? existing?.guildId ?? null,
            channelId: input.channelId ?? existing?.channelId ?? null,
            status: input.status,
            lastCheckedAt: checkedAt,
            lastSuccessAt: input.status === 'paused' ? existing?.lastSuccessAt ?? null : null,
            lastFailureAt: input.status === 'error' ? checkedAt : null,
            lastDeliveryAt: existing?.lastDeliveryAt ?? null,
            consecutiveFailures: input.status === 'error' ? (existing?.consecutiveFailures ?? 0) : 0,
            lastErrorCode: null,
            lastErrorMessage: null,
            metadata: input.metadata ?? existing?.metadata ?? null,
        } as CreationAttributes<IntegrationHealth>;

        await this.upsert(payload, ['provider', 'configId']);
    }

    private async getSummary(baseWhere: WhereOptions<Attributes<IntegrationHealth>>): Promise<IntegrationHealthSummary> {
        const [total, ...counts] = await Promise.all([
            this.model.count({ where: baseWhere }),
            ...INTEGRATION_HEALTH_STATUSES.map(status => this.model.count({ where: { ...baseWhere, status } })),
        ]);

        const summary: IntegrationHealthSummary = {
            total,
            healthy: 0,
            warning: 0,
            error: 0,
            paused: 0,
            unknown: 0,
        };

        INTEGRATION_HEALTH_STATUSES.forEach((status, index) => {
            summary[status] = counts[index] ?? 0;
        });

        return summary;
    }
}

function buildWhere(
    options: IntegrationHealthListOptions,
    includeStatus: boolean
): WhereOptions<Attributes<IntegrationHealth>> {
    const where: Partial<Record<keyof Attributes<IntegrationHealth>, unknown>> = {};
    if (options.provider) where.provider = options.provider;
    if (options.guildId) where.guildId = options.guildId;
    if (includeStatus && options.status) where.status = options.status;
    return where as WhereOptions<Attributes<IntegrationHealth>>;
}

function clampLimit(value: number | undefined): number {
    if (value === undefined) return 100;
    if (!Number.isFinite(value)) return 100;
    return Math.max(1, Math.min(200, Math.floor(value)));
}

function normalizeErrorCode(code: string): string {
    const normalized = code.trim().toUpperCase().replace(/[^A-Z0-9_:-]/g, '_');
    return normalized.length > 0 ? normalized.slice(0, 64) : 'UNKNOWN_ERROR';
}

function truncateErrorMessage(message: string): string {
    const normalized = message.trim();
    if (normalized.length <= MAX_ERROR_MESSAGE_LENGTH) return normalized;
    return `${normalized.slice(0, MAX_ERROR_MESSAGE_LENGTH - 3)}...`;
}

function normalizeRecord(record: IntegrationHealthRecord): IntegrationHealthRecord {
    return {
        ...record,
        metadata: normalizeMetadata((record as { metadata?: unknown }).metadata),
    };
}

function normalizeMetadata(value: unknown): IntegrationHealthMetadata | null {
    if (!value) return null;
    if (typeof value === 'object' && !Array.isArray(value)) {
        return value as IntegrationHealthMetadata;
    }
    if (typeof value === 'string') {
        try {
            const parsed: unknown = JSON.parse(value);
            if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
                return parsed as IntegrationHealthMetadata;
            }
        } catch {
            return { raw: value };
        }
        return { raw: value };
    }
    return { raw: value };
}
