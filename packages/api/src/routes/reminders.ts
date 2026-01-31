import { createBaseRouter } from '../utils/createBaseRouter.js';
import { getConfigManager } from '@zeffuro/fakegaming-common/managers';
import { jwtAuth } from '../middleware/auth.js';
import { validateBodyForModel, validateParams } from '@zeffuro/fakegaming-common';
import { ReminderConfig } from '@zeffuro/fakegaming-common/models';
import { z } from 'zod';
import type { AuthenticatedRequest } from '../types/express.js';
import { UniqueConstraintError } from 'sequelize';

// Zod schemas
const idParamSchema = z.object({ id: z.string().min(1) });

// Router
const router = createBaseRouter();

/**
 * @openapi
 * /reminders:
 *   get:
 *     summary: List all reminders
 *     tags: [Reminders]
 *     responses:
 *       200:
 *         description: List of reminders
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/ReminderConfig'
 */
router.get('/', async (_req, res) => {
    const reminders = await getConfigManager().reminderManager.getAllPlain();
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
    const { id } = req.params;
    const reminder = await getConfigManager().reminderManager.findByPkPlain(id as string);
    if (!reminder) return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Reminder not found' } });
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
 *             $ref: '#/components/schemas/ReminderConfig'
 *     responses:
 *       201:
 *         description: Created
 *       400:
 *         $ref: '#/components/responses/BadRequest'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       409:
 *         $ref: '#/components/responses/Conflict'
 */
router.post('/', jwtAuth, validateBodyForModel(ReminderConfig, 'create'), async (req, res) => {
    try {
        const created = await getConfigManager().reminderManager.addPlain(req.body);
        res.status(201).json(created);
    } catch (error) {
        if (error instanceof UniqueConstraintError) {
            res.status(409).json({ error: { code: 'CONFLICT', message: 'Reminder with this ID already exists' } });
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
router.delete('/:id', jwtAuth, validateParams(idParamSchema), async (req, res) => {
    const { discordId } = (req as AuthenticatedRequest).user;
    const { id } = req.params;
    const reminder = await getConfigManager().reminderManager.findByPkPlain(id as string);
    if (!reminder) return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Reminder not found' } });
    await getConfigManager().reminderManager.removeByPk(id as string);
    console.log(`[AUDIT] User ${discordId} deleted reminder ${id} at ${new Date().toISOString()}`);
    res.json({ success: true });
});

export { router };
