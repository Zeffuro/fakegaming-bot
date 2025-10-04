import {Router} from 'express';
import {getConfigManager} from '@zeffuro/fakegaming-common/managers';
import {jwtAuth} from '../middleware/auth.js';
import type { AuthenticatedRequest } from '../types/express.js';

const router = Router();

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
router.get('/', async (_, res) => {
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
 *         description: Not found
 */
router.get('/:id', async (req, res) => {
    const { id } = req.params;
    if (!id) return res.status(400).json({ error: 'Missing id parameter' });
    const reminder = await getConfigManager().reminderManager.findByPkPlain(id);
    if (!reminder) return res.status(404).json({error: 'Reminder not found'});
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
 */
router.post('/', jwtAuth, async (req, res) => {
    const created = await getConfigManager().reminderManager.addPlain(req.body);
    res.status(201).json(created);
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
 */
router.delete('/:id', jwtAuth, async (req, res) => {
    const { discordId } = (req as AuthenticatedRequest).user;
    const { id } = req.params;

    if (!id) return res.status(400).json({ error: 'Missing id parameter' });

    const reminder = await getConfigManager().reminderManager.findByPkPlain(id);
    if (!reminder) {
        return res.status(404).json({error: 'Reminder not found'});
    }

    await getConfigManager().reminderManager.removeReminder({id});

    console.log(`[AUDIT] User ${discordId} deleted reminder ${id} at ${new Date().toISOString()}`);

    res.json({success: true});
});

export default router;
