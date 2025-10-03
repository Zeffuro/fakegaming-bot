import {Router} from 'express';
import {getConfigManager} from '@zeffuro/fakegaming-common/managers';
import {jwtAuth} from '../middleware/auth.js';
import {requireGuildAdmin} from '../utils/authHelpers.js';

const router = Router();

/**
 * @openapi
 * /patchSubscriptions:
 *   get:
 *     summary: List all patch subscriptions
 *     tags: [PatchSubscriptions]
 *     responses:
 *       200:
 *         description: List of patch subscriptions
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/PatchSubscriptionConfig'
 */
router.get('/', async (req, res) => {
    const subs = await getConfigManager().patchSubscriptionManager.getAllPlain();
    res.json(subs);
});

/**
 * @openapi
 * /patchSubscriptions:
 *   post:
 *     summary: Subscribe to a game/channel
 *     tags: [PatchSubscriptions]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/PatchSubscriptionConfig'
 *     responses:
 *       201:
 *         description: Created
 */
router.post('/', jwtAuth, requireGuildAdmin, async (req, res) => {
    const { game, channelId, guildId } = req.body;
    if (!game || !channelId || !guildId) return res.status(400).json({ error: 'Missing game, channelId, or guildId' });
    await getConfigManager().patchSubscriptionManager.subscribe(game, channelId, guildId);
    res.status(201).json({success: true});
});

/**
 * @openapi
 * /patchSubscriptions:
 *   put:
 *     summary: Upsert (add or update) a patch subscription
 *     tags: [PatchSubscriptions]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/PatchSubscriptionConfig'
 *     responses:
 *       200:
 *         description: Success
 */
router.put('/', jwtAuth, requireGuildAdmin, async (req, res) => {
    const { game, channelId, guildId } = req.body;
    if (!game || !channelId || !guildId) return res.status(400).json({ error: 'Missing game, channelId, or guildId' });
    await getConfigManager().patchSubscriptionManager.upsertSubscription(req.body);
    res.json({success: true});
});

export default router;
