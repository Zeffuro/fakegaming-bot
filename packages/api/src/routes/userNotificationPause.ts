import type { Request } from 'express';
import { z } from 'zod';
import { PersonalNotificationPauseManager, PersonalError } from '@zeffuro/fakegaming-common/managers';
import { createBaseRouter } from '../utils/createBaseRouter.js';
import { validateBody, validateQuery } from '../localization/validation.js';
import { sendLocalizedError } from '../localization/responses.js';
import { isServiceRequest } from '../middleware/serviceAuth.js';
import type { AuthenticatedRequest } from '../types/express.js';

const router = createBaseRouter(); const manager = new PersonalNotificationPauseManager();
const owner = (req: Request) => (req as AuthenticatedRequest).user.discordId;
const schema = z.object({ enabled: z.boolean(), resumeAt: z.string().max(100).nullable(), timezone: z.string().min(1).max(100),
    version: z.number().int().min(0).max(2147483647) }).strict();
router.use((req, res, next) => {
    res.setHeader('Cache-Control', 'private, no-store'); res.vary('Accept-Language');
    const user = (req as Partial<AuthenticatedRequest>).user;
    if (isServiceRequest(req) || !user?.discordId || typeof user.discordId !== 'string' || user.discordId.startsWith('service:')) {
        sendLocalizedError(req, res, 401, 'UNAUTHORIZED', 'unauthorized'); return;
    }
    next();
});
/**
 * @openapi
 * /userNotificationPause:
 *   get:
 *     summary: Get the owner's account-wide personal notification pause
 *     tags: [NotificationPause]
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: Effective pause state and automatic resume deadline }
 *   patch:
 *     summary: Pause or resume automatic personal DMs using the saved timezone
 *     tags: [NotificationPause]
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: Updated versioned pause preferences }
 */
router.get('/', validateQuery(z.object({}).strict()), async (req, res) => res.json(await manager.preferences(owner(req))));
router.patch('/', validateQuery(z.object({}).strict()), validateBody(schema), async (req, res) => {
    try { res.json(await manager.configure(owner(req), req.body as z.infer<typeof schema>)); }
    catch (error) {
        if (!(error instanceof PersonalError)) throw error;
        sendLocalizedError(req, res, error.code === 'stale' ? 409 : 400, error.code.toUpperCase(),
            error.code === 'stale' ? 'notificationPauseStale' : 'notificationPauseInvalid');
    }
});
export { router };
