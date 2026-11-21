import { createBaseRouter } from '../utils/createBaseRouter.js';
import { getConfigManager } from '@zeffuro/fakegaming-common/managers';
import { jwtOrService } from '../middleware/auth.js';
import { isServiceRequest } from '../middleware/serviceAuth.js';
import { isDashboardAdmin } from '../utils/dashboardAdmin.js';
import type { Request, Response, NextFunction } from 'express';
import type { AuthenticatedRequest } from '../types/express.js';
import { validateParams, validateBody } from '../localization/validation.js';
import {
    userCreateRequestSchema,
    userDefaultReminderTimeSpanUpdateRequestSchema,
    userTimezoneUpdateRequestSchema,
    userUpdateRequestSchema,
} from '@zeffuro/fakegaming-common/api';
import { z } from 'zod';
import { sendLocalizedError } from '../localization/responses.js';

// Zod schemas
const discordIdParamSchema = z.object({ discordId: z.string().min(1) });

// Router
const router = createBaseRouter();

type UserSettingsUpdate = {
    timezone?: string;
    defaultReminderTimeSpan?: string;
};

function requireUserAccess(req: Request, res: Response, next: NextFunction): void {
    const userId = (req as AuthenticatedRequest).user?.discordId;
    const targetId = req.params.discordId ?? req.body?.discordId;
    if (isServiceRequest(req) || isDashboardAdmin(userId) || (userId && userId === targetId)) {
        next();
        return;
    }
    sendLocalizedError(req, res, 403, 'FORBIDDEN', 'forbidden');
}

async function updateExistingUserSettings(discordId: string, update: UserSettingsUpdate): Promise<boolean> {
    const manager = getConfigManager().userManager;
    const user = await manager.getOnePlain({ discordId });
    if (!user) return false;

    await manager.updatePlain(update, { discordId });
    return true;
}

/**
 * @openapi
 * /users:
 *   get:
 *     summary: List users accessible to the caller
 *     tags: [Users]
 *     responses:
 *       200:
 *         description: The caller's user record, or all user records for dashboard admins and internal services
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       429:
 *         $ref: '#/components/responses/RateLimitExceeded'
 *     headers:
 *       X-RateLimit-Limit:
 *         $ref: '#/components/headers/X-RateLimit-Limit'
 *       X-RateLimit-Remaining:
 *         $ref: '#/components/headers/X-RateLimit-Remaining'
 *       X-RateLimit-Reset:
 *         $ref: '#/components/headers/X-RateLimit-Reset'
 */
router.get('/', async (req, res) => {
    const userId = (req as AuthenticatedRequest).user?.discordId;
    const manager = getConfigManager().userManager;
    if (isServiceRequest(req) || isDashboardAdmin(userId)) {
        return res.json(await manager.getAllPlain());
    }
    if (!userId) return sendLocalizedError(req, res, 401, 'UNAUTHORIZED', 'authenticationRequired');
    const users = await manager.getManyPlain({ discordId: userId });
    res.json(users);
});

/**
 * @openapi
 * /users/{discordId}:
 *   get:
 *     summary: Get a user by Discord ID
 *     tags: [Users]
 *     parameters:
 *       - in: path
 *         name: discordId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: User config
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 */
router.get('/:discordId', validateParams(discordIdParamSchema), requireUserAccess, async (req, res) => {
    const { discordId } = req.params;
    const user = await getConfigManager().userManager.findByPkPlain(discordId as string);
    if (!user) return sendLocalizedError(req, res, 404, 'NOT_FOUND', 'userNotFound');
    res.json(user);
});

/**
 * @openapi
 * /users:
 *   post:
 *     summary: Create a new user
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/UserCreateRequest'
 *     responses:
 *       201:
 *         description: Created
 *       400:
 *         $ref: '#/components/responses/BadRequest'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 */
router.post('/', jwtOrService, validateBody(userCreateRequestSchema), requireUserAccess, async (req, res) => {
    await getConfigManager().userManager.addPlain(req.body);
    res.status(201).json({ success: true });
});

/**
 * @openapi
 * /users/{discordId}:
 *   put:
 *     summary: Update a user by Discord ID
 *     tags: [Users]
 *     parameters:
 *       - in: path
 *         name: discordId
 *         required: true
 *         schema:
 *           type: string
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/UserUpdateRequest'
 *     responses:
 *       200:
 *         description: Updated
 *       400:
 *         $ref: '#/components/responses/BadRequest'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 */
router.put('/:discordId', jwtOrService, validateParams(discordIdParamSchema), validateBody(userUpdateRequestSchema), requireUserAccess, async (req, res) => {
    const { discordId } = req.params;
    const user = await getConfigManager().userManager.findByPkPlain(discordId as string);
    if (!user) return sendLocalizedError(req, res, 404, 'NOT_FOUND', 'userNotFound');
    await getConfigManager().userManager.updatePlain(req.body, { discordId: discordId as string });
    const updated = await getConfigManager().userManager.findByPkPlain(discordId as string);
    res.json(updated);
});

/**
 * @openapi
 * /users/{discordId}/timezone:
 *   put:
 *     summary: Set timezone for a user
 *     tags: [Users]
 *     parameters:
 *       - in: path
 *         name: discordId
 *         required: true
 *         schema:
 *           type: string
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/UserTimezoneUpdateRequest'
 *     responses:
 *       200:
 *         description: Success
 *       400:
 *         $ref: '#/components/responses/BadRequest'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 */
router.put(
    '/:discordId/timezone',
    jwtOrService,
    validateParams(discordIdParamSchema),
    validateBody(userTimezoneUpdateRequestSchema),
    requireUserAccess,
    async (req, res) => {
        const { discordId } = req.params as z.infer<typeof discordIdParamSchema>;
        const { timezone } = req.body as z.infer<typeof userTimezoneUpdateRequestSchema>;
        const updated = await updateExistingUserSettings(discordId, { timezone });
        if (!updated) return sendLocalizedError(req, res, 404, 'NOT_FOUND', 'userNotFound');
        res.json({ success: true });
    }
);

/**
 * @openapi
 * /users/{discordId}/defaultReminderTimeSpan:
 *   put:
 *     summary: Set default reminder timespan for a user
 *     tags: [Users]
 *     parameters:
 *       - in: path
 *         name: discordId
 *         required: true
 *         schema:
 *           type: string
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/UserDefaultReminderTimeSpanUpdateRequest'
 *     responses:
 *       200:
 *         description: Success
 *       400:
 *         $ref: '#/components/responses/BadRequest'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 */
router.put(
    '/:discordId/defaultReminderTimeSpan',
    jwtOrService,
    validateParams(discordIdParamSchema),
    validateBody(userDefaultReminderTimeSpanUpdateRequestSchema),
    requireUserAccess,
    async (req, res) => {
        const { discordId } = req.params as z.infer<typeof discordIdParamSchema>;
        const { timespan } = req.body as z.infer<typeof userDefaultReminderTimeSpanUpdateRequestSchema>;
        const updated = await updateExistingUserSettings(discordId, { defaultReminderTimeSpan: timespan });
        if (!updated) return sendLocalizedError(req, res, 404, 'NOT_FOUND', 'userNotFound');
        res.json({ success: true });
    }
);

/**
 * @openapi
 * /users/{discordId}:
 *   delete:
 *     summary: Delete a user by Discord ID
 *     tags: [Users]
 *     parameters:
 *       - in: path
 *         name: discordId
 *         required: true
 *         schema:
 *           type: string
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Success
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 */
router.delete('/:discordId', jwtOrService, validateParams(discordIdParamSchema), requireUserAccess, async (req, res) => {
    const { discordId } = req.params;
    await getConfigManager().userManager.removeByPk(discordId as string);
    res.json({ success: true });
});

export { router };
