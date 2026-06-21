import type { Request } from 'express';
import {
    getConfigManager,
    getLogger,
    sanitizeAuditMetadata,
    type AuditActorType,
    type AuditEventSeverity,
    type AuditEventStatus,
} from '@zeffuro/fakegaming-common';
import type { AuthenticatedRequest } from '../types/express.js';
import { isServiceRequest } from '../middleware/serviceAuth.js';
import { getRequestId, getSafeRequestContext } from './requestContext.js';

const log = getLogger({ name: 'api:audit' });
let cleanupTimer: NodeJS.Timeout | undefined;

export interface AuditEventParams {
    actorId?: string | null;
    actorType?: AuditActorType;
    action: string;
    targetType: string;
    targetId?: string | number | null;
    guildId?: string | null;
    severity?: AuditEventSeverity;
    status?: AuditEventStatus;
    requestId?: string | null;
    metadata?: Record<string, unknown> | null;
}

export async function recordAuditEvent(req: Request, params: AuditEventParams): Promise<void> {
    const user = (req as AuthenticatedRequest).user;
    const actorType = params.actorType ?? (isServiceRequest(req) ? 'service' : 'user');
    const actorId = params.actorId ?? user?.discordId ?? (actorType === 'service' ? 'service' : null);

    await recordAuditEventDirect({
        ...params,
        actorId,
        actorType,
        requestId: params.requestId ?? getRequestId(req) ?? null,
    });
}

export function getAuditRequestMetadata(req: Request, extra: Record<string, unknown> = {}): Record<string, unknown> {
    return {
        ...getSafeRequestContext(req),
        ...extra,
    };
}

export async function recordSystemAuditEvent(params: AuditEventParams): Promise<void> {
    await recordAuditEventDirect({
        ...params,
        actorId: params.actorId ?? 'system',
        actorType: params.actorType ?? 'system',
    });
}

export function scheduleAuditEventCleanup(): void {
    if (process.env.NODE_ENV === 'test' || process.env.OPENAPI_BUILD === '1') return;
    if (cleanupTimer) return;

    const intervalMs = readPositiveNumberEnv('AUDIT_EVENT_CLEANUP_INTERVAL_MS', 24 * 60 * 60 * 1000);
    const runCleanup = () => {
        const retentionDays = readPositiveNumberEnv('AUDIT_EVENT_RETENTION_DAYS', 90);
        getConfigManager().auditEventManager.cleanupOlderThan(retentionDays)
            .then((deleted) => {
                if (deleted > 0) {
                    log.info({ deleted, retentionDays }, 'Cleaned up old audit events');
                }
            })
            .catch((err) => {
                log.warn({ err }, 'Audit event cleanup failed');
            });
    };

    runCleanup();
    cleanupTimer = setInterval(runCleanup, intervalMs);
    cleanupTimer.unref?.();
}

async function recordAuditEventDirect(params: AuditEventParams & { actorId?: string | null; actorType?: AuditActorType }): Promise<void> {
    try {
        await getConfigManager().auditEventManager.record({
            actorId: params.actorId ?? null,
            actorType: params.actorType ?? 'user',
            action: params.action,
            targetType: params.targetType,
            targetId: params.targetId === undefined || params.targetId === null ? null : String(params.targetId),
            guildId: params.guildId ?? null,
            severity: params.severity ?? 'info',
            status: params.status ?? 'success',
            requestId: params.requestId ?? null,
            metadata: sanitizeAuditMetadata(params.metadata),
        });
    } catch (err) {
        log.warn({
            err,
            action: params.action,
            targetType: params.targetType,
            status: params.status ?? 'success',
        }, 'Failed to persist audit event');
    }
}

function readPositiveNumberEnv(name: string, fallback: number): number {
    const raw = process.env[name];
    if (!raw) return fallback;
    const parsed = Number(raw);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}
