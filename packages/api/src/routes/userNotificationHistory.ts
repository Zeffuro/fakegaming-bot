import { z } from 'zod';
import { PersonalNotificationHistoryManager } from '@zeffuro/fakegaming-common/managers';
import { createBaseRouter } from '../utils/createBaseRouter.js';
import { validateQuery } from '../localization/validation.js';
import { sendLocalizedError } from '../localization/responses.js';
import { isServiceRequest } from '../middleware/serviceAuth.js';
import type { AuthenticatedRequest } from '../types/express.js';

const router = createBaseRouter();
const manager = new PersonalNotificationHistoryManager();
const querySchema = z.object({
    kind: z.enum(['reminder', 'follow', 'schedule', 'briefing', 'digest', 'anime']).optional(),
    status: z.enum(['pending', 'sent', 'delayed', 'skipped', 'failed', 'uncertain']).optional(),
    offset: z.coerce.number().int().min(0).max(1000).default(0),
    limit: z.coerce.number().int().min(1).max(100).default(20),
}).strict();
router.use((req, res, next) => {
    res.setHeader('Cache-Control', 'private, no-store');
    res.vary('Accept-Language');
    const user = (req as Partial<AuthenticatedRequest>).user;
    if (isServiceRequest(req) || !user?.discordId || typeof user.discordId !== 'string' || user.discordId.startsWith('service:')) {
        sendLocalizedError(req, res, 401, 'UNAUTHORIZED', 'unauthorized'); return;
    }
    next();
});
/**
 * @openapi
 * /userNotificationHistory:
 *   get:
 *     summary: List the owner's private automatic notification history
 *     tags: [NotificationHistory]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - { in: query, name: kind, schema: { type: string, enum: [reminder, follow, schedule, briefing, digest, anime] } }
 *       - { in: query, name: status, schema: { type: string, enum: [pending, sent, delayed, skipped, failed, uncertain] } }
 *       - { in: query, name: offset, schema: { type: integer, minimum: 0, maximum: 1000, default: 0 } }
 *       - { in: query, name: limit, schema: { type: integer, minimum: 1, maximum: 100, default: 20 } }
 *     responses:
 *       200: { description: Newest first, owner-only notification records with bounded retention }
 */
router.get('/', validateQuery(querySchema), async (req, res) => {
    const query = querySchema.parse(req.query);
    const userId = (req as AuthenticatedRequest).user.discordId;
    res.json(await manager.list(userId, query));
});
export { router };
