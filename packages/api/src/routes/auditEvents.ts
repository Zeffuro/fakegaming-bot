import { z } from 'zod';
import { getConfigManager, validateQuery } from '@zeffuro/fakegaming-common';
import { createBaseRouter } from '../utils/createBaseRouter.js';
import { jwtOrService } from '../middleware/auth.js';
import { requireDashboardAdmin } from '../utils/dashboardAdmin.js';

const router = createBaseRouter();

const auditEventsQuerySchema = z.object({
    limit: z.coerce.number().int().min(1).max(200).optional(),
    offset: z.coerce.number().int().min(0).max(10000).optional(),
    action: z.string().trim().min(1).max(128).optional(),
    targetType: z.string().trim().min(1).max(64).optional(),
    actorId: z.string().trim().min(1).max(255).optional(),
    guildId: z.string().trim().min(1).max(255).optional(),
    severity: z.enum(['info', 'warn', 'error']).optional(),
    status: z.enum(['success', 'failure']).optional(),
}).strict();

/**
 * @openapi
 * /auditEvents:
 *   get:
 *     summary: List recent admin audit events
 *     tags: [Audit]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Recent audit events
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 */
router.get('/', jwtOrService, requireDashboardAdmin, validateQuery(auditEventsQuerySchema), async (req, res) => {
    const query = req.query as z.infer<typeof auditEventsQuerySchema>;
    const result = await getConfigManager().auditEventManager.list(query);

    res.json({
        ...result,
        events: result.events.map(event => ({
            ...event,
            timestamp: event.timestamp.toISOString(),
            createdAt: event.createdAt?.toISOString(),
            updatedAt: event.updatedAt?.toISOString(),
        })),
    });
});

export { router };
