import { createBaseRouter } from '../utils/createBaseRouter.js';
import { getConfigManager } from '@zeffuro/fakegaming-common/managers';
import { jwtAuth } from '../middleware/auth.js';
import { requireGuildAdmin, checkUserGuildAccess } from '../utils/authHelpers.js';
import { validateParams, validateBodyForModel } from '@zeffuro/fakegaming-common';
import { BirthdayConfig } from '@zeffuro/fakegaming-common/models';
import { z } from 'zod';
import type { AuthenticatedRequest } from '../types/express.js';
import { UniqueConstraintError } from 'sequelize';

const router = createBaseRouter();

// ✨ Single source of truth - params via zod; body via model lazily
const userGuildParamSchema = z.object({
    userId: z.string().min(1),
    guildId: z.string().min(1)
});

/**
 * @openapi
 * /birthdays:
 *   get:
 *     summary: List all birthdays
 *     tags: [Birthdays]
 *     responses:
 *       200:
 *         description: List of birthdays
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/BirthdayConfig'
 */
router.get('/', async (_req, res) => {
    const birthdays = await getConfigManager().birthdayManager.getAllPlain();
    res.json(birthdays);
});

/**
 * @openapi
 * /birthdays/{userId}/{guildId}:
 *   get:
 *     summary: Get a birthday by userId and guildId
 *     tags: [Birthdays]
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *       - in: path
 *         name: guildId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Birthday config
 *       404:
 *         description: Not found
 */
router.get('/:userId/:guildId', validateParams(userGuildParamSchema), async (req, res) => {
    const { userId, guildId } = req.params;
    const birthday = await getConfigManager().birthdayManager.getBirthday(userId, guildId);
    if (!birthday) throw { status: 404, message: 'Birthday not found' };
    res.json(birthday);
});

/**
 * @openapi
 * /birthdays:
 *   post:
 *     summary: Add or update a birthday
 *     tags: [Birthdays]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/BirthdayConfig'
 *     responses:
 *       201:
 *         description: Created
 */
router.post('/', jwtAuth, requireGuildAdmin, validateBodyForModel(BirthdayConfig, 'create'), async (req, res) => {
    const { discordId } = (req as AuthenticatedRequest).user;
    const { userId, guildId } = req.body;
    try {
        await getConfigManager().birthdayManager.addPlain(req.body);
        console.log(`[AUDIT] User ${discordId} set birthday for user ${userId} in guild ${guildId}`);
        res.status(201).json({ success: true });
    } catch (error) {
        if (error instanceof UniqueConstraintError) {
            res.status(409).json({ error: 'Birthday already exists for this user in this guild' });
        } else {
            throw error;
        }
    }
});

/**
 * @openapi
 * /birthdays/{userId}/{guildId}:
 *   delete:
 *     summary: Remove a birthday by userId and guildId
 *     tags: [Birthdays]
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *       - in: path
 *         name: guildId
 *         required: true
 *         schema:
 *           type: string
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Success
 */
router.delete('/:userId/:guildId', jwtAuth, validateParams(userGuildParamSchema), async (req, res) => {
    const { userId, guildId } = req.params;
    const existing = await getConfigManager().birthdayManager.getBirthday(userId, guildId);
    if (!existing) return res.status(404).json({ error: 'Birthday not found' });
    const access = await checkUserGuildAccess(req, res, guildId);
    if (!access.authorized) return;
    await getConfigManager().birthdayManager.removeBirthday(userId, guildId);
    res.json({ success: true });
});

export { router };
