import {Router} from 'express';
import {getConfigManager} from '@zeffuro/fakegaming-common/managers';
import {jwtAuth} from '../middleware/auth.js';
import {requireGuildAdmin} from '../utils/authHelpers.js';
import type { AuthenticatedRequest } from '../types/express.js';

const router = Router();

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
router.get('/', async (req, res) => {
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
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/BirthdayConfig'
 *       404:
 *         description: Not found
 */
router.get('/:userId/:guildId', async (req, res) => {
    const { userId, guildId } = req.params;
    if (!userId || !guildId) return res.status(400).json({ error: 'Missing userId or guildId parameter' });
    const birthday = await getConfigManager().birthdayManager.getBirthday({ userId, guildId });
    if (!birthday) return res.status(404).json({error: 'Birthday not found'});
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
router.post('/', jwtAuth, requireGuildAdmin, async (req, res) => {
    const { discordId } = (req as AuthenticatedRequest).user;
    const {userId, guildId, date, day, month, year, channelId} = req.body;
    if (!userId || !guildId || (!date && (day === undefined || month === undefined || year === undefined))) {
        return res.status(400).json({ error: 'Missing required birthday fields' });
    }
    let birthdayFields: any = {userId, guildId, channelId};
    if (date) {
        const [y, m, d] = date.split('-').map(Number);
        birthdayFields = {...birthdayFields, year: y, month: m, day: d};
    } else {
        if (year !== undefined) birthdayFields.year = year;
        if (month !== undefined) birthdayFields.month = month;
        if (day !== undefined) birthdayFields.day = day;
    }
    await getConfigManager().birthdayManager.set(birthdayFields, 'userId');

    console.log(`[AUDIT] User ${discordId} set birthday for user ${userId} in guild ${guildId} at ${new Date().toISOString()}`);

    res.status(201).json({success: true});
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
router.delete('/:userId/:guildId', jwtAuth, requireGuildAdmin, async (req, res) => {
    const { userId, guildId } = req.params;

    if (!userId || !guildId) return res.status(400).json({ error: 'Missing userId or guildId parameter' });

    await getConfigManager().birthdayManager.removeBirthday({userId, guildId});

    res.json({success: true});
});

export default router;
