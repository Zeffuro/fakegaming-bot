import type { Request } from 'express';
import { z } from 'zod';
import { MorningBriefingManager, PersonalError } from '@zeffuro/fakegaming-common/managers';
import { createBaseRouter } from '../utils/createBaseRouter.js';
import { validateBody, validateQuery } from '../localization/validation.js';
import { sendLocalizedError } from '../localization/responses.js';
import { isServiceRequest } from '../middleware/serviceAuth.js';
import type { AuthenticatedRequest } from '../types/express.js';
import { resolveUserOutputLocale } from '../localization/locale.js';
import { formatMorningBriefing, loadMorningAgenda } from '../personalToday/morningBriefing.js';

const router = createBaseRouter();
const manager = new MorningBriefingManager();
const owner = (req: Request) => (req as AuthenticatedRequest).user.discordId;
const settingsSchema = z.object({ enabled: z.boolean(), localTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
    timezone: z.string().min(1).max(100), version: z.number().int().min(0).max(Number.MAX_SAFE_INTEGER) }).strict();

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
 * /morningBriefings:
 *   get:
 *     summary: Get private morning briefing preferences in the owner's saved timezone
 *     tags: [MorningBriefings]
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: Opt-in preferences, local delivery time and saved timezone }
 *   patch:
 *     summary: Enable or disable the owner's private morning briefing
 *     tags: [MorningBriefings]
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: Updated versioned preferences }
 * /morningBriefings/preview:
 *   get:
 *     summary: Preview today's private briefing without sending a message
 *     tags: [MorningBriefings]
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: Bounded exact content and complete omitted item counts }
 */
router.get('/', validateQuery(z.object({}).strict()), async (req, res) => res.json(await manager.preferences(owner(req))));
router.patch('/', validateQuery(z.object({}).strict()), validateBody(settingsSchema), async (req, res) => {
    try { res.json(await manager.configure(owner(req), req.body as z.infer<typeof settingsSchema>)); }
    catch (error) {
        if (!(error instanceof PersonalError)) throw error;
        sendLocalizedError(req, res, error.code === 'stale' ? 409 : 400, error.code.toUpperCase(),
            error.code === 'stale' ? 'briefingStale' : 'briefingInvalid');
    }
});
router.get('/preview', validateQuery(z.object({}).strict()), async (req, res) => {
    const userId = owner(req); const settings = await manager.preferences(userId);
    const [agenda, locale] = await Promise.all([loadMorningAgenda(userId, settings.timezone, Date.now()), resolveUserOutputLocale(userId)]);
    res.json(formatMorningBriefing(agenda, locale));
});

export { router };
