import { z } from 'zod';
import { getConfigManager, PersonalError } from '@zeffuro/fakegaming-common/managers';
import { createBaseRouter } from '../utils/createBaseRouter.js';
import { validateBody, validateParams, validateQuery } from '../localization/validation.js';
import { sendLocalizedError } from '../localization/responses.js';
import type { AuthenticatedRequest } from '../types/express.js';
import { isServiceRequest } from '../middleware/serviceAuth.js';

const router = createBaseRouter();
const editSchema = z.object({
    version: z.number().int().min(0).max(Number.MAX_SAFE_INTEGER),
    title: z.string().trim().min(1).max(120),
    checklist: z.array(z.object({ text: z.string().trim().min(1).max(120), done: z.boolean() }).strict()).max(10),
    due: z.string().trim().min(1).max(100).nullable().optional(),
    timezone: z.string().trim().min(1).max(100),
}).strict();

router.use((req, res, next) => {
    res.setHeader('Cache-Control', 'private, no-store');
    res.vary('Accept-Language');
    const user = (req as Partial<AuthenticatedRequest>).user;
    if (isServiceRequest(req) || !user || typeof user.discordId !== 'string' || !user.discordId || user.discordId.startsWith('service:')) {
        sendLocalizedError(req, res, 401, 'UNAUTHORIZED', 'unauthorized');
        return;
    }
    next();
});

/**
 * @openapi
 * /userTasks:
 *   get:
 *     summary: List active and retained completed tasks for the authenticated owner
 *     tags: [UserTasks]
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: Owner tasks and saved timezone }
 * /userTasks/{id}:
 *   patch:
 *     summary: Edit an active owner task with a version and saved timezone guard
 *     tags: [UserTasks]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - { in: path, name: id, required: true, schema: { type: string, format: uuid } }
 *     responses:
 *       200: { description: Updated private task }
 */
router.get('/', validateQuery(z.object({}).strict()), async (req, res) => {
    const userId = (req as AuthenticatedRequest).user.discordId;
    const cm = getConfigManager();
    const [active, completed, settings] = await Promise.all([
        cm.userTaskManager.list(userId), cm.userTaskManager.list(userId, true), cm.userManager.getUser({ discordId: userId }),
    ]);
    res.json({ active, completed, timezone: settings?.timezone?.trim() || 'UTC' });
});
router.patch('/:id', validateParams(z.object({ id: z.string().uuid() }).strict()), validateBody(editSchema), async (req, res) => {
    const userId = (req as AuthenticatedRequest).user.discordId;
    const body = req.body as z.infer<typeof editSchema>;
    const { id } = req.params as { id: string };
    try {
        const cm = getConfigManager();
        const timezone = (await cm.userManager.getUser({ discordId: userId }))?.timezone?.trim() || 'UTC';
        if (body.timezone !== timezone) throw new PersonalError('invalid');
        res.json(await cm.userTaskManager.edit(id, userId, body.version, body));
    } catch (error) {
        if (!(error instanceof PersonalError)) throw error;
        const status = error.code === 'missing' ? 404 : error.code === 'stale' ? 409 : 400;
        sendLocalizedError(req, res, status, error.code.toUpperCase(),
            error.code === 'missing' ? 'taskEditorMissing' : error.code === 'stale' ? 'taskEditorStale' : 'taskEditorInvalid');
    }
});

export { router };
