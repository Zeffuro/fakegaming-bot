import { z } from 'zod';
import { getConfigManager, validateParams, validateQuery, type NotificationListResult } from '@zeffuro/fakegaming-common';
import { createBaseRouter } from '../utils/createBaseRouter.js';
import { jwtOrService } from '../middleware/auth.js';
import { checkUserGuildAccess } from '../utils/authHelpers.js';
import { requireDashboardAdmin } from '../utils/dashboardAdmin.js';

const router = createBaseRouter();

const notificationsGuildParamsSchema = z.object({
    guildId: z.string().trim().min(1).max(255),
}).strict();

const notificationsGuildQuerySchema = z.object({
    provider: z.string().trim().min(1).max(64).optional(),
    limit: z.coerce.number().int().min(1).max(100).optional(),
    offset: z.coerce.number().int().min(0).max(10000).optional(),
}).strict();

const notificationsAdminQuerySchema = z.object({
    provider: z.string().trim().min(1).max(64).optional(),
    guildId: z.string().trim().min(1).max(255).optional(),
    limit: z.coerce.number().int().min(1).max(100).optional(),
    offset: z.coerce.number().int().min(0).max(10000).optional(),
}).strict();

/**
 * @openapi
 * /notifications/guild/{guildId}:
 *   get:
 *     summary: List recent notification delivery records for a guild
 *     tags: [Notifications]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: guildId
 *         required: true
 *         schema:
 *           type: string
 *       - in: query
 *         name: provider
 *         required: false
 *         schema:
 *           type: string
 *       - in: query
 *         name: limit
 *         required: false
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 100
 *       - in: query
 *         name: offset
 *         required: false
 *         schema:
 *           type: integer
 *           minimum: 0
 *           maximum: 10000
 *     responses:
 *       200:
 *         description: Guild-scoped notification delivery records and provider counts
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 */
router.get('/guild/:guildId', validateParams(notificationsGuildParamsSchema), validateQuery(notificationsGuildQuerySchema), async (req, res) => {
    const { guildId } = req.params as z.infer<typeof notificationsGuildParamsSchema>;
    const query = req.query as z.infer<typeof notificationsGuildQuerySchema>;
    const access = await checkUserGuildAccess(req, res, guildId);
    if (!access.authorized) return;

    const result = await getConfigManager().notificationsManager.list({
        ...query,
        guildId,
    });

    res.json(serializeListResult(result));
});

/**
 * @openapi
 * /notifications/admin:
 *   get:
 *     summary: List recent notification delivery records
 *     tags: [Notifications]
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
 *         name: limit
 *         required: false
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 100
 *       - in: query
 *         name: offset
 *         required: false
 *         schema:
 *           type: integer
 *           minimum: 0
 *           maximum: 10000
 *     responses:
 *       200:
 *         description: Recent notification delivery records and provider counts
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 */
router.get('/admin', jwtOrService, requireDashboardAdmin, validateQuery(notificationsAdminQuerySchema), async (req, res) => {
    const query = req.query as z.infer<typeof notificationsAdminQuerySchema>;
    const result = await getConfigManager().notificationsManager.list(query);

    res.json(serializeListResult(result));
});

function serializeListResult(result: NotificationListResult) {
    return {
        ...result,
        records: result.records.map(record => ({
            ...record,
            createdAt: toIsoString(record.createdAt),
            updatedAt: toIsoString(record.updatedAt),
        })),
    };
}

function toIsoString(value: Date | string | null | undefined): string | null {
    if (!value) return null;
    if (value instanceof Date) return value.toISOString();
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? value : parsed.toISOString();
}

export { router };
