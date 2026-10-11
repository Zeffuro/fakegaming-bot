import type { Request, Response } from 'express';
import { z } from 'zod';
import { getConfigManager, PersonalError } from '@zeffuro/fakegaming-common/managers';
import { createBaseRouter } from '../utils/createBaseRouter.js';
import { validateBody, validateParams, validateQuery } from '../localization/validation.js';
import { sendLocalizedError } from '../localization/responses.js';
import type { AuthenticatedRequest } from '../types/express.js';
import { isServiceRequest } from '../middleware/serviceAuth.js';

const router = createBaseRouter();
const idSchema = z.object({ id: z.string().uuid() }).strict();
const version = z.number().int().min(0).max(Number.MAX_SAFE_INTEGER);
const content = { title: z.string().trim().min(1).max(120), items: z.array(z.string().trim().min(1).max(120)).min(1).max(10) };
const contentSchema = z.object(content).strict();
const owner = (req: Request) => (req as AuthenticatedRequest).user.discordId;
router.use((req, res, next) => {
    res.setHeader('Cache-Control', 'private, no-store'); res.vary('Accept-Language');
    const user = (req as Partial<AuthenticatedRequest>).user;
    if (isServiceRequest(req) || !user?.discordId || typeof user.discordId !== 'string' || user.discordId.startsWith('service:')) {
        sendLocalizedError(req, res, 401, 'UNAUTHORIZED', 'unauthorized'); return;
    }
    next();
});
async function safely(req: Request, res: Response, action: () => Promise<unknown>, status = 200) {
    try { res.status(status).json(await action()); } catch (error) {
        if (!(error instanceof PersonalError)) throw error;
        const code = error.code;
        sendLocalizedError(req, res, code === 'missing' ? 404 : code === 'stale' || code === 'capacity' ? 409 : 400,
            code.toUpperCase(), code === 'missing' ? 'checklistMissing' : code === 'stale' ? 'checklistStale' : code === 'capacity' ? 'checklistCapacity' : 'checklistInvalid');
    }
}

/**
 * @openapi
 * /userChecklistTemplates:
 *   get:
 *     summary: List the authenticated owner's reusable checklists
 *     tags: [Checklists]
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: Private reusable checklists }
 *   post:
 *     summary: Save a reusable personal checklist
 *     tags: [Checklists]
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       201: { description: Saved checklist }
 * /userChecklistTemplates/{id}:
 *   patch:
 *     summary: Edit an owner checklist with a version check
 *     tags: [Checklists]
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: Updated checklist }
 *   delete:
 *     summary: Remove an owner checklist without changing tasks started from it
 *     tags: [Checklists]
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: Removed checklist }
 * /userChecklistTemplates/{id}/start:
 *   post:
 *     summary: Start a fresh unchecked task from a saved checklist
 *     tags: [Checklists]
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       201: { description: New independent private task }
 */
router.get('/', validateQuery(z.object({}).strict()), (req, res) => safely(req, res, () => getConfigManager().userChecklistTemplateManager.list(owner(req))));
router.post('/', validateBody(contentSchema), (req, res) => safely(req, res, () => {
    const body = req.body as z.infer<typeof contentSchema>;
    return getConfigManager().userChecklistTemplateManager.create(owner(req), body.title, body.items);
}, 201));
router.patch('/:id', validateParams(idSchema), validateBody(z.object({ ...content, version }).strict()), (req, res) => safely(req, res, () =>
    getConfigManager().userChecklistTemplateManager.edit(String(req.params.id), owner(req), req.body.version, req.body.title, req.body.items)));
router.delete('/:id', validateParams(idSchema), validateBody(z.object({ version }).strict()), (req, res) => safely(req, res, async () => {
    await getConfigManager().userChecklistTemplateManager.remove(String(req.params.id), owner(req), req.body.version);
    return { removed: true };
}));
const startSchema = z.object({ version, due: z.string().max(100).nullable().optional(), timezone: z.string().max(100).optional() }).strict();
router.post('/:id/start', validateParams(idSchema), validateBody(startSchema), (req, res) => safely(req, res, async () => {
    const cm = getConfigManager(); const userId = owner(req);
    const body = req.body as z.infer<typeof startSchema>;
    return cm.userChecklistTemplateManager.start(String(req.params.id), userId, body.version, cm.userTaskManager, { ...body, exact: true });
}, 201));
export { router };
