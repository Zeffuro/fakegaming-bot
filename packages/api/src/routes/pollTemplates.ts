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
const content = { title: z.string().trim().min(1).max(120), question: z.string().trim().min(1).max(200),
    options: z.array(z.string().trim().min(1).max(200)).min(2).max(5), durationMinutes: z.number().int().min(1).max(1440),
    allowMultiple: z.boolean().optional(), hideResults: z.boolean().optional(), ranked: z.boolean().optional() };
const validMode = (input: { ranked?: boolean; allowMultiple?: boolean }) => !(input.ranked && input.allowMultiple);
const contentSchema = z.object(content).strict().refine(validMode);
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
            code.toUpperCase(), code === 'missing' ? 'pollTemplateMissing' : code === 'stale' ? 'pollTemplateStale' : code === 'capacity' ? 'pollTemplateCapacity' : 'pollTemplateInvalid');
    }
}

/**
 * @openapi
 * components:
 *   schemas:
 *     PollTemplateInput:
 *       type: object
 *       required: [title, question, options, durationMinutes]
 *       properties:
 *         title: { type: string, minLength: 1, maxLength: 120 }
 *         question: { type: string, minLength: 1, maxLength: 200 }
 *         options:
 *           type: array
 *           minItems: 2
 *           maxItems: 5
 *           items: { type: string, minLength: 1, maxLength: 200 }
 *         durationMinutes: { type: integer, minimum: 1, maximum: 1440 }
 *         allowMultiple: { type: boolean, default: false }
 *         hideResults: { type: boolean, default: false }
 *         ranked: { type: boolean, default: false, description: Private ordered ballots; incompatible with allowMultiple. Partial rankings are allowed. }
 *     PollTemplateEdit:
 *       allOf:
 *         - $ref: '#/components/schemas/PollTemplateInput'
 *         - type: object
 *           required: [version]
 *           properties:
 *             version: { type: integer, minimum: 0 }
 * /pollTemplates:
 *   get:
 *     summary: List private reusable poll templates
 *     tags: [Poll templates]
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: Owner poll settings without votes }
 *   post:
 *     summary: Save a private reusable poll template
 *     tags: [Poll templates]
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema: { $ref: '#/components/schemas/PollTemplateInput' }
 *     responses:
 *       201: { description: Saved poll template }
 * /pollTemplates/{id}:
 *   patch:
 *     summary: Edit an owner poll template with a version check
 *     tags: [Poll templates]
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema: { $ref: '#/components/schemas/PollTemplateEdit' }
 *     responses:
 *       200: { description: Updated template }
 *   delete:
 *     summary: Delete an owner template without changing live polls
 *     tags: [Poll templates]
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: Removed template }
 */
router.get('/', validateQuery(z.object({}).strict()), (req, res) => safely(req, res, () => getConfigManager().pollTemplateManager.list(owner(req))));
router.post('/', validateBody(contentSchema), (req, res) => safely(req, res, () => getConfigManager().pollTemplateManager.create(owner(req), req.body), 201));
router.patch('/:id', validateParams(idSchema), validateBody(z.object({ ...content, version }).strict().refine(validMode)), (req, res) => safely(req, res, () =>
    getConfigManager().pollTemplateManager.edit(String(req.params.id), owner(req), req.body.version, req.body)));
router.delete('/:id', validateParams(idSchema), validateBody(z.object({ version }).strict()), (req, res) => safely(req, res, async () => {
    await getConfigManager().pollTemplateManager.remove(String(req.params.id), owner(req), req.body.version);
    return { removed: true };
}));
export { router };
