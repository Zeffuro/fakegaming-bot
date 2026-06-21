import { z } from 'zod';
import { getConfigManager, validateQuery } from '@zeffuro/fakegaming-common';
import { createBaseRouter } from '../utils/createBaseRouter.js';
import { jwtAuth, jwtOrService } from '../middleware/auth.js';
import { requireGuildAdmin } from '../utils/authHelpers.js';
import { requireDashboardAdmin } from '../utils/dashboardAdmin.js';

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
