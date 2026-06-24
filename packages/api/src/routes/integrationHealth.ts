import { z } from 'zod';
import { getConfigManager, validateQuery } from '@zeffuro/fakegaming-common';
import { createBaseRouter } from '../utils/createBaseRouter.js';
import { jwtAuth, jwtOrService } from '../middleware/auth.js';
import { requireGuildAdmin } from '../utils/authHelpers.js';
import { requireDashboardAdmin } from '../utils/dashboardAdmin.js';
import { recordAuditEvent } from '../utils/audit.js';

const router = createBaseRouter();

const integrationHealthStatusSchema = z.enum(['unknown', 'healthy', 'warning', 'error', 'paused']);

const integrationHealthQuerySchema = z.object({
    guildId: z.string().trim().min(1),
    provider: z.string().trim().min(1).max(64).optional(),
}).strict();

const integrationHealthAdminQuerySchema = z.object({
    provider: z.string().trim().min(1).max(64).optional(),
    guildId: z.string().trim().min(1).max(255).optional(),
    status: integrationHealthStatusSchema.optional(),
    limit: z.coerce.number().int().min(1).max(200).optional(),
    offset: z.coerce.number().int().min(0).max(10000).optional(),
}).strict();

interface IntegrationHealthRouteRecord {
    id?: number;
    provider: string;
    configId: string;
    guildId?: string | null;
    channelId?: string | null;
    status: string;
    lastCheckedAt?: Date | string | null;
    lastSuccessAt?: Date | string | null;
    lastFailureAt?: Date | string | null;
    lastDeliveryAt?: Date | string | null;
    consecutiveFailures: number;
    lastErrorCode?: string | null;
    lastErrorMessage?: string | null;
    metadata?: Record<string, unknown> | null;
    createdAt?: Date | string;
    updatedAt?: Date | string;
}

interface IntegrationHealthRouteManager {
    getForConfig(provider: string, configId: string | number): Promise<IntegrationHealthRouteRecord | null>;
    listForGuild(guildId: string, provider?: string): Promise<IntegrationHealthRouteRecord[]>;
    list(options?: {
        provider?: string;
        guildId?: string;
        status?: z.infer<typeof integrationHealthStatusSchema>;
        limit?: number;
        offset?: number;
    }): Promise<{
        records: IntegrationHealthRouteRecord[];
        total: number;
        limit: number;
        offset: number;
        summary: {
            total: number;
            healthy: number;
            warning: number;
            error: number;
            paused: number;
            unknown: number;
        };
    }>;
    recordSuccess(input: {
        provider: string;
        configId: string | number;
        guildId?: string | null;
        channelId?: string | null;
        delivered?: boolean;
        status?: Exclude<z.infer<typeof integrationHealthStatusSchema>, 'error'>;
        metadata?: Record<string, unknown> | null;
        checkedAt?: Date;
    }): Promise<void>;
}

/**
 * @openapi
 * /integrationHealth/admin:
 *   get:
 *     summary: List integration health across guilds
 *     tags: [IntegrationHealth]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: provider
 *         required: false
 *         schema:
 *           type: string
 *       - in: query
 *         name: guildId
 *         required: false
 *         schema:
 *           type: string
 *       - in: query
 *         name: status
 *         required: false
 *         schema:
 *           type: string
 *           enum: [unknown, healthy, warning, error, paused]
 *       - in: query
 *         name: limit
 *         required: false
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 200
 *       - in: query
 *         name: offset
 *         required: false
 *         schema:
 *           type: integer
 *           minimum: 0
 *           maximum: 10000
 *     responses:
 *       200:
 *         description: Integration health records and summary counts
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 */
router.get('/admin', jwtOrService, requireDashboardAdmin, validateQuery(integrationHealthAdminQuerySchema), async (req, res) => {
    const query = req.query as z.infer<typeof integrationHealthAdminQuerySchema>;
    const manager = (getConfigManager() as unknown as { integrationHealthManager: IntegrationHealthRouteManager }).integrationHealthManager;
    const result = await manager.list(query);

    res.json({
        ...result,
        records: result.records.map(serializeRecord),
    });
});

/**
 * @openapi
 * /integrationHealth/admin/{provider}/{configId}/resolve:
 *   post:
 *     summary: Mark a stale integration health finding as resolved
 *     tags: [IntegrationHealth]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Integration health record marked resolved
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 *       404:
 *         description: Health record not found
 */
router.post('/admin/:provider/:configId/resolve', jwtOrService, requireDashboardAdmin, async (req, res) => {
    const provider = String(req.params.provider ?? '').trim();
    const configId = String(req.params.configId ?? '').trim();
    if (!provider || !configId) {
        return res.status(400).json({ error: { code: 'BAD_REQUEST', message: 'Provider and config ID are required' } });
    }

    const manager = (getConfigManager() as unknown as { integrationHealthManager: IntegrationHealthRouteManager }).integrationHealthManager;
    const existing = await manager.getForConfig(provider, configId);
    if (!existing) {
        return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Integration health record not found' } });
    }

    const resolvedAt = new Date();
    await manager.recordSuccess({
        provider: existing.provider,
        configId: existing.configId,
        guildId: existing.guildId ?? null,
        channelId: existing.channelId ?? null,
        delivered: false,
        metadata: {
            ...(existing.metadata ?? {}),
            manualResolution: {
                resolvedAt: resolvedAt.toISOString(),
                previousStatus: existing.status,
                previousConsecutiveFailures: existing.consecutiveFailures,
                previousErrorCode: existing.lastErrorCode ?? null,
            },
        },
        checkedAt: resolvedAt,
    });

    await recordAuditEvent(req, {
        action: 'integrationHealth.resolve',
        targetType: 'integrationHealth',
        targetId: `${existing.provider}:${existing.configId}`,
        guildId: existing.guildId ?? null,
        severity: 'info',
        status: 'success',
        metadata: {
            provider: existing.provider,
            configId: existing.configId,
            previousStatus: existing.status,
            previousConsecutiveFailures: existing.consecutiveFailures,
            previousErrorCode: existing.lastErrorCode ?? null,
        },
    });

    const updated = await manager.getForConfig(existing.provider, existing.configId);
    res.json({ record: updated ? serializeRecord(updated) : null });
});

/**
 * @openapi
 * /integrationHealth:
 *   get:
 *     summary: List integration health for a guild
 *     tags: [IntegrationHealth]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: guildId
 *         required: true
 *         schema:
 *           type: string
 *       - in: query
 *         name: provider
 *         required: false
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Integration health records for the guild
 *       400:
 *         $ref: '#/components/responses/BadRequest'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 */
router.get('/', jwtAuth, validateQuery(integrationHealthQuerySchema), requireGuildAdmin, async (req, res) => {
    const { guildId, provider } = req.query as z.infer<typeof integrationHealthQuerySchema>;
    const manager = (getConfigManager() as unknown as { integrationHealthManager: IntegrationHealthRouteManager }).integrationHealthManager;
    const records = await manager.listForGuild(guildId, provider);

    res.json({
        records: records.map(serializeRecord),
    });
});

function serializeRecord(record: IntegrationHealthRouteRecord) {
    return {
        ...record,
        lastCheckedAt: toIsoString(record.lastCheckedAt),
        lastSuccessAt: toIsoString(record.lastSuccessAt),
        lastFailureAt: toIsoString(record.lastFailureAt),
        lastDeliveryAt: toIsoString(record.lastDeliveryAt),
        createdAt: toIsoString(record.createdAt),
        updatedAt: toIsoString(record.updatedAt),
    };
}

function toIsoString(value: Date | string | null | undefined): string | null {
    if (!value) return null;
    if (value instanceof Date) return value.toISOString();
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? value : parsed.toISOString();
}

export { router };
