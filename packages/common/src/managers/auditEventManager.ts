import { Attributes, CreationAttributes, Op, WhereOptions } from 'sequelize';
import { BaseManager } from './baseManager.js';
import {
    AuditEvent,
    type AuditActorType,
    type AuditEventMetadata,
    type AuditEventSeverity,
    type AuditEventStatus,
} from '../models/audit-event.js';

export interface AuditEventInput {
    timestamp?: Date;
    actorId?: string | null;
    actorType?: AuditActorType;
    action: string;
    targetType: string;
    targetId?: string | null;
    guildId?: string | null;
    severity?: AuditEventSeverity;
    status?: AuditEventStatus;
    requestId?: string | null;
    metadata?: AuditEventMetadata | null;
}

export interface AuditEventRecord {
    id: number;
    timestamp: Date;
    actorId: string | null;
    actorType: AuditActorType;
    action: string;
    targetType: string;
    targetId: string | null;
    guildId: string | null;
    severity: AuditEventSeverity;
    status: AuditEventStatus;
    requestId: string | null;
    metadata: AuditEventMetadata | null;
    createdAt?: Date;
    updatedAt?: Date;
}

export interface AuditEventListOptions {
    limit?: number;
    offset?: number;
    action?: string;
    targetType?: string;
    actorId?: string;
    guildId?: string;
    severity?: AuditEventSeverity;
    status?: AuditEventStatus;
}

export interface AuditEventListResult {
    events: AuditEventRecord[];
    total: number;
    limit: number;
    offset: number;
}

export class AuditEventManager extends BaseManager<AuditEvent> {
    constructor() {
        super(AuditEvent);
    }

    async record(input: AuditEventInput): Promise<AuditEventRecord> {
        const created = await this.model.create({
            timestamp: input.timestamp ?? new Date(),
            actorId: input.actorId ?? null,
            actorType: input.actorType ?? 'user',
            action: input.action,
            targetType: input.targetType,
            targetId: input.targetId ?? null,
            guildId: input.guildId ?? null,
            severity: input.severity ?? 'info',
            status: input.status ?? 'success',
            requestId: input.requestId ?? null,
            metadata: input.metadata ?? null,
        } as CreationAttributes<AuditEvent>);

        return normalizeAuditEvent(created.get({ plain: true }) as CreationAttributes<AuditEvent>);
    }

    async list(options: AuditEventListOptions = {}): Promise<AuditEventListResult> {
        const limit = clampInteger(options.limit ?? 50, 1, 200);
        const offset = clampInteger(options.offset ?? 0, 0, 10000);
        const where: Record<string, unknown> = {};

        if (options.action) where.action = options.action;
        if (options.targetType) where.targetType = options.targetType;
        if (options.actorId) where.actorId = options.actorId;
        if (options.guildId) where.guildId = options.guildId;
        if (options.severity) where.severity = options.severity;
        if (options.status) where.status = options.status;

        const result = await this.model.findAndCountAll({
            where: where as WhereOptions<Attributes<AuditEvent>>,
            order: [['timestamp', 'DESC'], ['id', 'DESC']],
            limit,
            offset,
            raw: true,
        });

        return {
            events: result.rows.map(row => normalizeAuditEvent(row as unknown as CreationAttributes<AuditEvent>)),
            total: typeof result.count === 'number' ? result.count : 0,
            limit,
            offset,
        };
    }

    async cleanupOlderThan(retentionDays: number): Promise<number> {
        const safeRetentionDays = clampInteger(retentionDays, 1, 3650);
        const cutoff = new Date(Date.now() - safeRetentionDays * 24 * 60 * 60 * 1000);

        return this.model.destroy({
            where: {
                timestamp: { [Op.lt]: cutoff },
            } as WhereOptions<Attributes<AuditEvent>>,
        });
    }
}

function clampInteger(value: number, min: number, max: number): number {
    if (!Number.isFinite(value)) return min;
    return Math.min(max, Math.max(min, Math.floor(value)));
}

function normalizeAuditEvent(row: CreationAttributes<AuditEvent>): AuditEventRecord {
    return {
        id: Number(row.id),
        timestamp: normalizeDate(row.timestamp),
        actorId: normalizeNullableString(row.actorId),
        actorType: normalizeActorType(row.actorType),
        action: String(row.action),
        targetType: String(row.targetType),
        targetId: normalizeNullableString(row.targetId),
        guildId: normalizeNullableString(row.guildId),
        severity: normalizeSeverity(row.severity),
        status: normalizeStatus(row.status),
        requestId: normalizeNullableString(row.requestId),
        metadata: normalizeMetadata(row.metadata),
        createdAt: row.createdAt ? normalizeDate(row.createdAt) : undefined,
        updatedAt: row.updatedAt ? normalizeDate(row.updatedAt) : undefined,
    };
}

function normalizeDate(value: unknown): Date {
    if (value instanceof Date) return value;
    if (typeof value === 'string' || typeof value === 'number') {
        const parsed = new Date(value);
        if (!Number.isNaN(parsed.getTime())) return parsed;
    }
    return new Date();
}

function normalizeNullableString(value: unknown): string | null {
    return typeof value === 'string' && value.length > 0 ? value : null;
}

function normalizeMetadata(value: unknown): AuditEventMetadata | null {
    if (value === null || value === undefined) return null;

    if (typeof value === 'string') {
        try {
            const parsed: unknown = JSON.parse(value);
            return normalizeMetadata(parsed);
        } catch {
            return { raw: value };
        }
    }

    if (typeof value === 'object' && !Array.isArray(value)) {
        return value as AuditEventMetadata;
    }

    return { value };
}

function normalizeActorType(value: unknown): AuditActorType {
    return value === 'service' || value === 'system' || value === 'user' ? value : 'user';
}

function normalizeSeverity(value: unknown): AuditEventSeverity {
    return value === 'warn' || value === 'error' || value === 'info' ? value : 'info';
}

function normalizeStatus(value: unknown): AuditEventStatus {
    return value === 'failure' || value === 'success' ? value : 'success';
}
