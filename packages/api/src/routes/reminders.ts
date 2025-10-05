import {Router} from 'express';
import {getConfigManager} from '@zeffuro/fakegaming-common/managers';
import {jwtAuth} from '../middleware/auth.js';
import type { AuthenticatedRequest } from '../types/express.js';
import { NotFoundError } from '@zeffuro/fakegaming-common';

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
    try {
        const reminder = await getConfigManager().reminderManager.findByPkPlain(id);
        res.json(reminder);
    } catch (error) {
        if (error instanceof NotFoundError) {
            return res.status(404).json({ error: 'Reminder not found' });
        }
        return res.status(500).json({ error: 'Failed to fetch reminder' });
    }
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
    const { id, guildId, userId, text, date } = req.body;
    if (typeof id !== 'string' || typeof guildId !== 'string' || typeof userId !== 'string' || typeof text !== 'string' || typeof date !== 'string') {
        return res.status(400).json({ error: 'All fields must be strings' });
    }
    if (!id || !guildId || !userId || !text || !date) {
        return res.status(400).json({ error: 'Missing required fields' });
    }
    try {
        const created = await getConfigManager().reminderManager.addPlain(req.body);
        res.status(201).json(created);
    } catch (err: any) {
        if (err?.code === 'SQLITE_CONSTRAINT' || err?.message?.includes('duplicate')) {
            return res.status(409).json({ error: 'Duplicate reminder' });
        }
        if (err?.name === 'ForbiddenError') {
            return res.status(403).json({ error: 'Forbidden' });
        }
        res.status(500).json({ error: 'Internal server error' });
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
 */
router.delete('/:id', jwtAuth, async (req, res) => {
    const { discordId } = (req as AuthenticatedRequest).user;
    const { id } = req.params;
    if (!id) return res.status(400).json({ error: 'Missing id parameter' });
    try {
        const reminder = await getConfigManager().reminderManager.findByPkPlain(id);
        if (!reminder) {
            return res.status(404).json({error: 'Reminder not found'});
        }
        await getConfigManager().reminderManager.removeReminder({id});
        console.log(`[AUDIT] User ${discordId} deleted reminder ${id} at ${new Date().toISOString()}`);
        res.json({success: true});
    } catch (err: any) {
        if (err?.name === 'ForbiddenError') {
            return res.status(403).json({ error: 'Forbidden' });
        }
        res.status(500).json({ error: 'Internal server error' });
    }
});

export default router;
