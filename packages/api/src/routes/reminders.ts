import { createBaseRouter } from '../utils/createBaseRouter.js';
import { getConfigManager } from '@zeffuro/fakegaming-common/managers';
import { jwtOrService } from '../middleware/auth.js';
import { isServiceRequest } from '../middleware/serviceAuth.js';
import { isDashboardAdmin } from '../utils/dashboardAdmin.js';
import { NotFoundError } from '@zeffuro/fakegaming-common';
import type { Request } from 'express';
import type { AuthenticatedRequest } from '../types/express.js';
import { validateBody, validateParams } from '../localization/validation.js';
import { reminderCreateRequestSchema } from '@zeffuro/fakegaming-common/api';
import { z } from 'zod';
import { UniqueConstraintError } from 'sequelize';
import { recordAuditEvent } from '../utils/audit.js';
import { sendLocalizedError } from '../localization/responses.js';

// Zod schemas
const idParamSchema = z.object({ id: z.string().min(1) });

// Router
const router = createBaseRouter();

function reminderAccess(req: Request) {
    const userId = (req as AuthenticatedRequest).user?.discordId;
    return { userId, canAccessAll: isServiceRequest(req) || isDashboardAdmin(userId) };
}

/**
 * @openapi
 * /reminders:
 *   get:
 *     summary: List reminders accessible to the caller
 *     tags: [Reminders]
 *     responses:
 *       200:
 *         description: The caller's reminders, or all reminders for dashboard admins and internal services
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/ReminderConfig'
 */
router.get('/', async (req, res) => {
    const { userId, canAccessAll } = reminderAccess(req);
    if (!userId) return sendLocalizedError(req, res, 401, 'UNAUTHORIZED', 'authenticationRequired');

    const manager = getConfigManager().reminderManager;
    const reminders = canAccessAll ? await manager.getAllPlain() : await manager.getRemindersByUser(userId);
    res.json(reminders);
});

/**
 * @openapi
 * /reminders/{id}:
 *   get:
 *     summary: Get a reminder by id
 *     tags: [Reminders]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Reminder config
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ReminderConfig'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 */
router.get('/:id', validateParams(idParamSchema), async (req, res) => {
    const id = String(req.params.id);
    const { userId, canAccessAll } = reminderAccess(req);
    if (!userId) return sendLocalizedError(req, res, 401, 'UNAUTHORIZED', 'authenticationRequired');

    const manager = getConfigManager().reminderManager;
    const reminder = canAccessAll ? await manager.findByPkPlain(id) : await manager.getForUser(id, userId);
    if (!reminder) return sendLocalizedError(req, res, 404, 'NOT_FOUND', 'reminderNotFound');
    res.json(reminder);
});

/**
 * @openapi
 * /reminders:
 *   post:
 *     summary: Add a new reminder
 *     tags: [Reminders]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/ReminderCreateRequest'
 *     responses:
 *       201:
 *         description: Created
 *       400:
 *         $ref: '#/components/responses/BadRequest'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 *       409:
 *         $ref: '#/components/responses/Conflict'
 */
router.post('/', jwtOrService, validateBody(reminderCreateRequestSchema), async (req, res) => {
    const { userId, canAccessAll } = reminderAccess(req);
    if (!canAccessAll && userId !== req.body.userId) {
        return sendLocalizedError(req, res, 403, 'FORBIDDEN', 'forbidden');
    }

    try {
        const created = await getConfigManager().reminderManager.addPlain(req.body);
        await recordAuditEvent(req, {
            action: 'reminder.create',
            targetType: 'reminder',
            targetId: created.id,
        });
        res.status(201).json(created);
    } catch (error) {
        if (error instanceof UniqueConstraintError) {
            sendLocalizedError(req, res, 409, 'CONFLICT', 'reminderExists');
        } else {
            throw error;
        }
    }
});

/**
 * @openapi
 * /reminders/{id}:
 *   delete:
 *     summary: Remove a reminder by id
 *     tags: [Reminders]
 *     parameters:
 *       - in: path
 *         name: id
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
 *       404:
 *         $ref: '#/components/responses/NotFound'
 */
router.delete('/:id', jwtOrService, validateParams(idParamSchema), async (req, res) => {
    const id = String(req.params.id);
    const { userId, canAccessAll } = reminderAccess(req);
    if (!userId) return sendLocalizedError(req, res, 401, 'UNAUTHORIZED', 'authenticationRequired');

    const manager = getConfigManager().reminderManager;
    try {
        if (canAccessAll) {
            await manager.removeByPk(id);
        } else if (!await manager.removeForUser(id, userId)) {
            return sendLocalizedError(req, res, 404, 'NOT_FOUND', 'reminderNotFound');
        }
    } catch (error) {
        if (!(error instanceof NotFoundError)) throw error;
        return sendLocalizedError(req, res, 404, 'NOT_FOUND', 'reminderNotFound');
    }

    await recordAuditEvent(req, {
        action: 'reminder.delete',
        targetType: 'reminder',
        targetId: id,
    });
    res.json({ success: true });
});

export { router };
