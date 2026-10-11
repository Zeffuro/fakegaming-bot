import type { Request } from 'express';
import { z } from 'zod';
import { UserDashboardLayoutManager, PersonalError } from '@zeffuro/fakegaming-common/managers';
import { dashboardSectionIds } from '@zeffuro/fakegaming-common/dashboard-layout';
import { createBaseRouter } from '../utils/createBaseRouter.js';
import { validateBody, validateQuery } from '../localization/validation.js';
import { sendLocalizedError } from '../localization/responses.js';
import { isServiceRequest } from '../middleware/serviceAuth.js';
import type { AuthenticatedRequest } from '../types/express.js';

const router = createBaseRouter();
const manager = new UserDashboardLayoutManager();
const owner = (req: Request) => (req as AuthenticatedRequest).user.discordId;
const version = z.number().int().min(0).max(2147483647);
const schema = z.object({ schemaVersion: z.literal(1), version,
    sections: z.array(z.object({ id: z.enum(dashboardSectionIds), visible: z.boolean() }).strict())
        .length(dashboardSectionIds.length).refine(entries => new Set(entries.map(entry => entry.id)).size === entries.length) }).strict();
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
 * /userDashboardLayout:
 *   get:
 *     summary: Get the authenticated owner's private panel layout
 *     tags: [DashboardLayout]
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: Versioned panel order and visibility }
 *   patch:
 *     summary: Save the owner's versioned panel layout
 *     tags: [DashboardLayout]
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: Updated private panel layout }
 * /userDashboardLayout/reset:
 *   post:
 *     summary: Reset the owner's panel layout to defaults
 *     tags: [DashboardLayout]
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: All panels visible in their default order }
 */
router.get('/', validateQuery(z.object({}).strict()), async (req, res) => res.json(await manager.get(owner(req))));
router.patch('/', validateQuery(z.object({}).strict()), validateBody(schema), async (req, res) => {
    try { res.json(await manager.save(owner(req), req.body as z.infer<typeof schema>)); }
    catch (error) {
        if (!(error instanceof PersonalError)) throw error;
        sendLocalizedError(req, res, error.code === 'stale' ? 409 : 400, error.code.toUpperCase(),
            error.code === 'stale' ? 'dashboardLayoutStale' : 'dashboardLayoutInvalid');
    }
});
router.post('/reset', validateQuery(z.object({}).strict()), validateBody(z.object({ version }).strict()), async (req, res) => {
    try { res.json(await manager.reset(owner(req), req.body.version as number)); }
    catch (error) {
        if (!(error instanceof PersonalError)) throw error;
        sendLocalizedError(req, res, error.code === 'stale' ? 409 : 400, error.code.toUpperCase(),
            error.code === 'stale' ? 'dashboardLayoutStale' : 'dashboardLayoutInvalid');
    }
});
export { router };
